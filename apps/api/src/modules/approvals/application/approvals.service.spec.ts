/**
 * Purpose: Unit tests for tenant-scoped expense approval workflow policy and lifecycle rules.
 * Caller: Vitest test runner.
 * Deps: ApprovalsService, mocked approval repository, mocked notification hooks, and AuthPrincipal.
 * MainFuncs: Verifies threshold evaluation, request creation, self-approval blocking, decision transitions, and transaction rejection integration.
 * SideEffects: None.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { ApprovalsService } from './approvals.service';

function createHarness() {
  const repository = {
    getPolicy: vi.fn(async () => policyRecord()),
    updatePolicy: vi.fn(async () => policyRecord()),
    findTransactionForApproval: vi.fn(async () => expenseTransaction()),
    evaluateApprovalState: vi.fn(async () => approvalState({ status: 'PENDING' })),
    requestApprovals: vi.fn(async () => approvalState({ status: 'PENDING', approvals: [approvalRecord()] })),
    listApprovals: vi.fn(async () => ({ items: [approvalRecord()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    listApprovalQueue: vi.fn(async () => ({ items: [approvalRecord()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    findApprovalById: vi.fn(async () => approvalRecord()),
    decideApproval: vi.fn(async () => approvalState({ status: 'APPROVED', approvals: [approvalRecord({ status: ApprovalStatus.APPROVED })] })),
    cancelApproval: vi.fn(async () => approvalRecord({ status: ApprovalStatus.CANCELLED })),
  };
  const hooks = {
    approvalRequested: vi.fn(async () => undefined),
    approvalReminder: vi.fn(async () => undefined),
    approvalCompleted: vi.fn(async () => undefined),
    approvalRejected: vi.fn(async () => undefined),
  };
  const principal: AuthPrincipal = {
    userId: 'treasurer-1',
    membershipId: 'membership-treasurer',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['approvals.read', 'approvals.decide', 'transactions.validate'],
  };
  const approver: AuthPrincipal = {
    ...principal,
    userId: 'chair-1',
    membershipId: 'membership-chair',
    roles: ['KETUA_RT'],
  };
  const service = new (ApprovalsService as any)(repository, hooks);
  return { approver, hooks, principal, repository, service };
}

describe('ApprovalsService', () => {
  it('evaluates below-threshold expense as not required when policy allows auto approval', async () => {
    const { principal, repository, service } = createHarness();
    repository.findTransactionForApproval.mockResolvedValueOnce(expenseTransaction({ amount: '25000' }));

    const result = await service.getTransactionApprovalStatus(principal, 'transaction-1');

    expect(result.status).toBe('NOT_REQUIRED');
    expect(repository.evaluateApprovalState).not.toHaveBeenCalled();
  });

  it('requests approval rows for above-threshold validated expense transactions', async () => {
    const { hooks, principal, repository, service } = createHarness();

    const result = await service.requestApproval(principal, 'transaction-1', { reason: 'Needs chair review', idempotencyKey: 'approval-request-1' }, { correlationId: 'corr-1' });

    expect(repository.requestApprovals).toHaveBeenCalledWith('rt-1', 'transaction-1', expect.objectContaining({ reason: 'Needs chair review' }), principal, expect.any(Object), { correlationId: 'corr-1' });
    expect(hooks.approvalRequested).toHaveBeenCalledWith(expect.objectContaining({ transactionId: 'transaction-1', rtId: 'rt-1' }));
    expect(result.status).toBe('PENDING');
  });

  it('prevents self approval when policy forbids it', async () => {
    const { principal, repository, service } = createHarness();
    repository.findApprovalById.mockResolvedValueOnce(approvalRecord({ requestedById: 'treasurer-1', approverMembershipId: 'membership-treasurer' }));

    await expect(service.approve(principal, 'approval-1', { decisionNote: 'OK' }, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.decideApproval).not.toHaveBeenCalled();
  });

  it('prevents duplicate approval decisions', async () => {
    const { approver, repository, service } = createHarness();
    repository.findApprovalById.mockResolvedValueOnce(approvalRecord({ status: ApprovalStatus.APPROVED, approverMembershipId: 'membership-chair' }));

    await expect(service.approve(approver, 'approval-1', {}, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.decideApproval).not.toHaveBeenCalled();
  });

  it('approves assigned pending approvals and emits completion hooks', async () => {
    const { approver, hooks, repository, service } = createHarness();
    repository.findApprovalById.mockResolvedValueOnce(approvalRecord({ approverMembershipId: 'membership-chair' }));

    const result = await service.approve(approver, 'approval-1', { decisionNote: 'Approved' }, { correlationId: 'corr-2' });

    expect(repository.decideApproval).toHaveBeenCalledWith('rt-1', 'approval-1', expect.objectContaining({ decision: 'APPROVED' }), approver, expect.any(Object), { correlationId: 'corr-2' });
    expect(hooks.approvalCompleted).toHaveBeenCalledWith(expect.objectContaining({ approvalId: 'approval-1', transactionId: 'transaction-1' }));
    expect(result.status).toBe('APPROVED');
  });

  it('rejects approval and emits rejection hooks', async () => {
    const { approver, hooks, repository, service } = createHarness();
    repository.findApprovalById.mockResolvedValueOnce(approvalRecord({ approverMembershipId: 'membership-chair' }));
    repository.decideApproval.mockResolvedValueOnce(approvalState({ status: 'REJECTED', transaction: expenseTransaction({ status: TransactionStatus.REJECTED }) }));

    const result = await service.reject(approver, 'approval-1', { decisionNote: 'Not valid' }, { correlationId: 'corr-3' });

    expect(repository.decideApproval).toHaveBeenCalledWith('rt-1', 'approval-1', expect.objectContaining({ decision: 'REJECTED' }), approver, expect.any(Object), { correlationId: 'corr-3' });
    expect(hooks.approvalRejected).toHaveBeenCalledWith(expect.objectContaining({ approvalId: 'approval-1', transactionId: 'transaction-1' }));
    expect(result.status).toBe('REJECTED');
  });

  it('keeps tenant isolation by treating missing approval records as not found', async () => {
    const { approver, repository, service } = createHarness();
    repository.findApprovalById.mockResolvedValueOnce(null as never);

    await expect(service.approve(approver, 'outside-approval', {}, {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

function policyRecord(overrides: Record<string, unknown> = {}) {
  return {
    thresholdAmount: '50000',
    autoApproveBelowThreshold: true,
    preventSelfApproval: true,
    approverRoleKeys: ['KETUA_RT'],
    requiredApprovals: 1,
    expiresInDays: 7,
    ...overrides,
  };
}

function expenseTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transaction-1',
    rtId: 'rt-1',
    type: TransactionType.EXPENSE,
    status: 'VALIDATED' as TransactionStatus,
    amount: '100000',
    createdById: 'treasurer-1',
    ...overrides,
  };
}

function approvalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval-1',
    rtId: 'rt-1',
    transactionId: 'transaction-1',
    requestedById: 'treasurer-1',
    approverMembershipId: 'membership-chair',
    decisionById: null,
    idempotencyKey: null,
    status: ApprovalStatus.PENDING,
    reason: 'Needs review',
    decisionNote: null,
    expiresAt: new Date('2030-01-08T00:00:00.000Z'),
    decidedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    approver: { membershipId: 'membership-chair', userId: 'chair-1', fullName: 'Chair' },
    transaction: expenseTransaction(),
    ...overrides,
  };
}

function approvalState(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: 'transaction-1',
    status: 'PENDING',
    requiredApprovals: 1,
    approvedCount: 0,
    pendingCount: 1,
    rejectedCount: 0,
    approvals: [approvalRecord()],
    transaction: expenseTransaction(),
    ...overrides,
  };
}
