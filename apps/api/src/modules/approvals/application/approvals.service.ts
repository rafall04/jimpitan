/**
 * Purpose: Application service for tenant-scoped expense approval workflows.
 * Caller: ApprovalsController, finance posting gates, notification hook tests, and future UI clients.
 * Deps: Approval repository port, notification hook port, AuthPrincipal, approval command contracts, and Prisma enums.
 * MainFuncs: Enforces threshold policy, self-approval policy, approval request lifecycle, decision validation, tenant scope, and hook dispatch.
 * SideEffects: Writes approval, transaction rejection, policy, audit, and hook effects through repository and hook ports.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { APPROVAL_NOTIFICATION_HOOKS, APPROVALS_REPOSITORY } from '../approvals.tokens';
import type {
  ApprovalListQuery,
  ApprovalQueueQuery,
  ApprovalRequestMeta,
  ApproveExpenseApprovalCommand,
  CancelExpenseApprovalCommand,
  RejectExpenseApprovalCommand,
  RequestExpenseApprovalCommand,
  UpdateApprovalPolicyCommand,
} from './approvals.commands';
import type { ApprovalStateRecord, ApprovalTransactionSummary, ExpenseApprovalPolicy, ExpenseApprovalRecord } from '../domain/approval.types';
import type { ApprovalNotificationHooksPort } from '../infrastructure/approval-notification.hooks.port';
import type { ApprovalsRepositoryPort } from '../infrastructure/approvals.repository.port';

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(APPROVALS_REPOSITORY) private readonly repository: ApprovalsRepositoryPort,
    @Inject(APPROVAL_NOTIFICATION_HOOKS) private readonly hooks: ApprovalNotificationHooksPort,
  ) {}

  async getPolicy(actor: AuthPrincipal): Promise<ExpenseApprovalPolicy> {
    return this.repository.getPolicy(actor.rtId);
  }

  async updatePolicy(actor: AuthPrincipal, command: UpdateApprovalPolicyCommand, meta: ApprovalRequestMeta): Promise<ExpenseApprovalPolicy> {
    this.assertPolicy(command);
    return this.repository.updatePolicy(actor.rtId, command, actor, meta);
  }

  async listApprovals(actor: AuthPrincipal, query: ApprovalListQuery): Promise<PaginatedResult<ExpenseApprovalRecord>> {
    return this.repository.listApprovals(actor.rtId, query);
  }

  async listApprovalQueue(actor: AuthPrincipal, query: ApprovalQueueQuery): Promise<PaginatedResult<ExpenseApprovalRecord>> {
    return this.repository.listApprovalQueue(actor.rtId, actor, query);
  }

  async getApproval(actor: AuthPrincipal, approvalId: string): Promise<ExpenseApprovalRecord> {
    const approval = await this.repository.findApprovalById(actor.rtId, approvalId);
    if (!approval) {
      throw new NotFoundException('Approval was not found.');
    }
    return approval;
  }

  async getTransactionApprovalStatus(actor: AuthPrincipal, transactionId: string): Promise<ApprovalStateRecord> {
    const [policy, transaction] = await Promise.all([this.repository.getPolicy(actor.rtId), this.getTransactionOrThrow(actor.rtId, transactionId)]);
    if (this.isApprovalNotRequired(transaction, policy)) {
      return this.notRequiredState(transaction, policy);
    }
    const state = await this.repository.evaluateApprovalState(actor.rtId, transactionId, policy);
    if (!state) {
      throw new NotFoundException('Transaction was not found.');
    }
    return state;
  }

  async requestApproval(actor: AuthPrincipal, transactionId: string, command: RequestExpenseApprovalCommand, meta: ApprovalRequestMeta): Promise<ApprovalStateRecord> {
    const [policy, transaction] = await Promise.all([this.repository.getPolicy(actor.rtId), this.getTransactionOrThrow(actor.rtId, transactionId)]);
    this.assertExpenseValidated(transaction);
    if (this.isApprovalNotRequired(transaction, policy)) {
      return this.notRequiredState(transaction, policy);
    }
    const state = await this.repository.requestApprovals(actor.rtId, transactionId, command, actor, policy, meta);
    await this.hooks.approvalRequested({
      rtId: actor.rtId,
      transactionId,
      actorUserId: actor.userId,
      approverMembershipIds: state.approvals.map((approval) => approval.approverMembershipId),
      status: state.status,
      correlationId: meta.correlationId,
    });
    return state;
  }

  async approve(actor: AuthPrincipal, approvalId: string, command: ApproveExpenseApprovalCommand, meta: ApprovalRequestMeta): Promise<ApprovalStateRecord> {
    const [policy, approval] = await Promise.all([this.repository.getPolicy(actor.rtId), this.getApproval(actor, approvalId)]);
    this.assertCanDecide(actor, approval, policy);
    const state = await this.repository.decideApproval(actor.rtId, approvalId, { decision: ApprovalStatus.APPROVED, decisionNote: command.decisionNote }, actor, policy, meta);
    await this.hooks.approvalCompleted({
      rtId: actor.rtId,
      transactionId: approval.transactionId,
      approvalId,
      actorUserId: actor.userId,
      status: state.status,
      correlationId: meta.correlationId,
    });
    return state;
  }

  async reject(actor: AuthPrincipal, approvalId: string, command: RejectExpenseApprovalCommand, meta: ApprovalRequestMeta): Promise<ApprovalStateRecord> {
    const [policy, approval] = await Promise.all([this.repository.getPolicy(actor.rtId), this.getApproval(actor, approvalId)]);
    this.assertCanDecide(actor, approval, policy);
    const state = await this.repository.decideApproval(actor.rtId, approvalId, { decision: ApprovalStatus.REJECTED, decisionNote: command.decisionNote }, actor, policy, meta);
    await this.hooks.approvalRejected({
      rtId: actor.rtId,
      transactionId: approval.transactionId,
      approvalId,
      actorUserId: actor.userId,
      status: state.status,
      correlationId: meta.correlationId,
    });
    return state;
  }

  async cancel(actor: AuthPrincipal, approvalId: string, command: CancelExpenseApprovalCommand, meta: ApprovalRequestMeta): Promise<ExpenseApprovalRecord> {
    const approval = await this.getApproval(actor, approvalId);
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Only pending approvals can be cancelled.');
    }
    const cancelled = await this.repository.cancelApproval(actor.rtId, approvalId, command, actor, meta);
    if (!cancelled) {
      throw new NotFoundException('Approval was not found.');
    }
    return cancelled;
  }

  private async getTransactionOrThrow(rtId: string, transactionId: string): Promise<ApprovalTransactionSummary> {
    const transaction = await this.repository.findTransactionForApproval(rtId, transactionId);
    if (!transaction) {
      throw new NotFoundException('Transaction was not found.');
    }
    return transaction;
  }

  private assertExpenseValidated(transaction: ApprovalTransactionSummary): void {
    if (transaction.type !== TransactionType.EXPENSE) {
      throw new BadRequestException('Only expense transactions can require approval.');
    }
    if (transaction.status !== ('VALIDATED' as TransactionStatus)) {
      throw new BadRequestException('Only validated expense transactions can request approval.');
    }
  }

  private assertCanDecide(actor: AuthPrincipal, approval: ExpenseApprovalRecord, policy: ExpenseApprovalPolicy): void {
    if (approval.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval has already been finalized.');
    }
    if (approval.approverMembershipId !== actor.membershipId) {
      throw new ForbiddenException('Only the assigned active approver can decide this approval.');
    }
    if (policy.preventSelfApproval && (approval.requestedById === actor.userId || approval.transaction.createdById === actor.userId)) {
      throw new ForbiddenException('Self approval is not allowed by policy.');
    }
  }

  private isApprovalNotRequired(transaction: ApprovalTransactionSummary, policy: ExpenseApprovalPolicy): boolean {
    if (transaction.type !== TransactionType.EXPENSE) {
      return true;
    }
    return policy.autoApproveBelowThreshold && new Prisma.Decimal(transaction.amount).lte(policy.thresholdAmount);
  }

  private notRequiredState(transaction: ApprovalTransactionSummary, policy: ExpenseApprovalPolicy): ApprovalStateRecord {
    return {
      transactionId: transaction.id,
      status: 'NOT_REQUIRED',
      requiredApprovals: policy.requiredApprovals,
      approvedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      approvals: [],
      transaction,
    };
  }

  private assertPolicy(command: UpdateApprovalPolicyCommand): void {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(command.thresholdAmount) || new Prisma.Decimal(command.thresholdAmount).lt(0)) {
      throw new BadRequestException('Approval threshold must fit cash precision and be non-negative.');
    }
    if (command.requiredApprovals < 1) {
      throw new BadRequestException('At least one approval is required when approval is required.');
    }
    if (command.approverRoleKeys.length === 0) {
      throw new BadRequestException('At least one approver role is required.');
    }
  }
}
