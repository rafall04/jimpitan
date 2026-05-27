/**
 * Purpose: Unit tests for conservative finance and approval UI workflow helpers.
 * Caller: Vitest test runner.
 * Deps: Finance workflow helpers and frontend contract types.
 * MainFuncs: Verifies immutable posted transactions, action visibility, and approval decision gating.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { getApprovalActions, getTransactionActions, isPostedTransactionImmutable } from './workflow';
import type { ApprovalRecord, FinanceTransactionRecord } from './types';

const transaction: FinanceTransactionRecord = {
  id: 'tx-1',
  rtId: 'rt-1',
  cashAccountId: 'account-1',
  categoryId: 'category-1',
  sourceCollectionId: null,
  referenceNumber: null,
  idempotencyKey: null,
  externalRef: null,
  type: 'EXPENSE',
  status: 'VALIDATED',
  amount: '25000',
  description: 'Electricity',
  transactionDate: '2026-05-26T00:00:00.000Z',
  createdById: 'user-1',
  updatedById: null,
  validatedById: 'user-2',
  validatedAt: '2026-05-26T01:00:00.000Z',
  validationNote: null,
  rejectedById: null,
  rejectedAt: null,
  rejectionReason: null,
  postedById: null,
  postedAt: null,
  voidedById: null,
  voidedAt: null,
  createdAt: '2026-05-26T00:00:00.000Z',
  updatedAt: '2026-05-26T01:00:00.000Z',
  cashAccount: { id: 'account-1', key: 'cash', name: 'Cash', currency: 'IDR' },
  category: { id: 'category-1', type: 'EXPENSE', key: 'utility', name: 'Utility' },
  ledger: null,
};

const approval: ApprovalRecord = {
  id: 'approval-1',
  rtId: 'rt-1',
  transactionId: 'tx-1',
  requestedById: 'user-1',
  approverMembershipId: 'member-1',
  decisionById: null,
  idempotencyKey: null,
  status: 'PENDING',
  reason: 'Above threshold',
  decisionNote: null,
  expiresAt: null,
  decidedAt: null,
  createdAt: '2026-05-26T00:00:00.000Z',
  updatedAt: '2026-05-26T00:00:00.000Z',
  approver: { membershipId: 'member-1', userId: 'user-2', fullName: 'Treasurer' },
  transaction: { id: 'tx-1', rtId: 'rt-1', type: 'EXPENSE', status: 'VALIDATED', amount: '25000', createdById: 'user-1' },
};

describe('finance workflow', () => {
  it('marks posted transactions immutable and hides lifecycle actions', () => {
    const posted = { ...transaction, status: 'POSTED' as const, postedAt: '2026-05-26T02:00:00.000Z' };

    expect(isPostedTransactionImmutable(posted)).toBe(true);
    expect(getTransactionActions(posted, new Set(['transactions.validate', 'transactions.post', 'transactions.delete']))).toEqual([]);
  });

  it('shows validate/reject for drafts and post only for validated transactions', () => {
    expect(getTransactionActions({ ...transaction, status: 'DRAFT' }, new Set(['transactions.validate', 'transactions.post', 'transactions.delete']))).toEqual(['validate', 'reject', 'void']);
    expect(getTransactionActions(transaction, new Set(['transactions.post']))).toEqual(['post']);
  });

  it('limits approval decisions to pending rows with decide permission', () => {
    expect(getApprovalActions(approval, new Set(['approvals.decide']))).toEqual(['approve', 'reject']);
    expect(getApprovalActions({ ...approval, status: 'APPROVED' }, new Set(['approvals.decide']))).toEqual([]);
  });
});
