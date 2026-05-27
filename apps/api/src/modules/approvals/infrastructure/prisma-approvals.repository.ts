/**
 * Purpose: Prisma persistence adapter for tenant-scoped expense approval workflow.
 * Caller: ApprovalsModule dependency injection for ApprovalsService.
 * Deps: PrismaService, Prisma enums/types, AuthPrincipal, and approvals repository port.
 * MainFuncs: Performs policy persistence, approval queue/detail reads, request creation, atomic decisions, cancellation, and audit writes.
 * SideEffects: Reads and writes settings, transactions, expense_approvals, memberships, roles, users, and audit_logs.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ApprovalStatus, AuditActorType, MembershipStatus, Prisma, TransactionStatus, TransactionType, UserStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  ApprovalListQuery,
  ApprovalQueueQuery,
  ApprovalRequestMeta,
  CancelExpenseApprovalCommand,
  DecideExpenseApprovalCommand,
  RequestExpenseApprovalCommand,
  UpdateApprovalPolicyCommand,
} from '../application/approvals.commands';
import type { ApprovalStateRecord, ApprovalTransactionSummary, ExpenseApprovalPolicy, ExpenseApprovalRecord } from '../domain/approval.types';
import type { ApprovalsRepositoryPort } from './approvals.repository.port';

const APPROVAL_POLICY_KEY = 'expense_approval_policy';

export const DEFAULT_EXPENSE_APPROVAL_POLICY: ExpenseApprovalPolicy = {
  thresholdAmount: '50000',
  autoApproveBelowThreshold: true,
  preventSelfApproval: true,
  approverRoleKeys: ['KETUA_RT'],
  requiredApprovals: 1,
  expiresInDays: 7,
};

type ApprovalTransactionDbRow = {
  id: string;
  rtId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Prisma.Decimal;
  createdById: string;
};

type ExpenseApprovalDbRow = {
  id: string;
  rtId: string;
  transactionId: string;
  requestedById: string;
  approverMembershipId: string;
  decisionById: string | null;
  idempotencyKey: string | null;
  status: ApprovalStatus;
  reason: string | null;
  decisionNote: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  approverMembership: {
    id: string;
    userId: string;
    user: { fullName: string };
  };
  transaction: ApprovalTransactionDbRow;
};

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

@Injectable()
export class PrismaApprovalsRepository implements ApprovalsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(rtId: string): Promise<ExpenseApprovalPolicy> {
    const setting = await this.prisma.setting.findUnique({ where: { rtId_key: { rtId, key: APPROVAL_POLICY_KEY } }, select: { value: true } });
    return this.normalizePolicy(setting?.value);
  }

  async updatePolicy(rtId: string, command: UpdateApprovalPolicyCommand, actor: AuthPrincipal, meta: ApprovalRequestMeta): Promise<ExpenseApprovalPolicy> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.setting.findUnique({ where: { rtId_key: { rtId, key: APPROVAL_POLICY_KEY } }, select: { value: true } });
      const policy = this.normalizePolicy(command);
      await tx.setting.upsert({
        where: { rtId_key: { rtId, key: APPROVAL_POLICY_KEY } },
        create: { rtId, key: APPROVAL_POLICY_KEY, value: policy, updatedById: actor.userId },
        update: { value: policy, updatedById: actor.userId },
      });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'APPROVAL_POLICY_UPDATED',
        entityType: 'approval_policy',
        beforeData: before ? this.normalizePolicy(before.value) : null,
        afterData: policy,
      });
      return policy;
    });
  }

  async listApprovals(rtId: string, query: ApprovalListQuery): Promise<PaginatedResult<ExpenseApprovalRecord>> {
    const where = this.approvalWhere(rtId, query);
    const [approvals, total] = await this.prisma.$transaction([
      this.prisma.expenseApproval.findMany({
        where,
        select: this.approvalSelect(),
        orderBy: this.approvalOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.expenseApproval.count({ where }),
    ]);
    return this.toPaginated(approvals.map((approval) => this.toApprovalRecord(approval)), query.page, query.limit, total);
  }

  async listApprovalQueue(rtId: string, actor: AuthPrincipal, query: ApprovalQueueQuery): Promise<PaginatedResult<ExpenseApprovalRecord>> {
    const where: Prisma.ExpenseApprovalWhereInput = {
      rtId,
      approverMembershipId: actor.membershipId,
      status: query.status ?? ApprovalStatus.PENDING,
      ...(query.search
        ? {
            OR: [
              { reason: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { transaction: { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
    const [approvals, total] = await this.prisma.$transaction([
      this.prisma.expenseApproval.findMany({
        where,
        select: this.approvalSelect(),
        orderBy: this.queueOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.expenseApproval.count({ where }),
    ]);
    return this.toPaginated(approvals.map((approval) => this.toApprovalRecord(approval)), query.page, query.limit, total);
  }

  async findApprovalById(rtId: string, approvalId: string): Promise<ExpenseApprovalRecord | null> {
    const approval = await this.prisma.expenseApproval.findFirst({
      where: { id: approvalId, rtId },
      select: this.approvalSelect(),
    });
    return approval ? this.toApprovalRecord(approval) : null;
  }

  async findTransactionForApproval(rtId: string, transactionId: string): Promise<ApprovalTransactionSummary | null> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, rtId, deletedAt: null },
      select: this.transactionSelect(),
    });
    return transaction ? this.toTransactionSummary(transaction) : null;
  }

  async evaluateApprovalState(rtId: string, transactionId: string, policy: ExpenseApprovalPolicy): Promise<ApprovalStateRecord | null> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, rtId, deletedAt: null },
      select: this.transactionSelect(),
    });
    if (!transaction) {
      return null;
    }
    const approvals = await this.prisma.expenseApproval.findMany({
      where: { rtId, transactionId },
      select: this.approvalSelect(),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return this.toApprovalState(transaction, approvals, policy);
  }

  async requestApprovals(
    rtId: string,
    transactionId: string,
    command: RequestExpenseApprovalCommand,
    actor: AuthPrincipal,
    policy: ExpenseApprovalPolicy,
    meta: ApprovalRequestMeta,
  ): Promise<ApprovalStateRecord> {
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
          const transaction = await tx.transaction.findFirst({
            where: { id: transactionId, rtId, deletedAt: null },
            select: this.transactionSelect(),
          });
          if (!transaction) {
            throw new BadRequestException('Transaction was not found.');
          }
          this.assertValidatedExpense(transaction);
          const existing = await tx.expenseApproval.findMany({
            where: { rtId, transactionId },
            select: this.approvalSelect(),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });
          if (existing.length > 0) {
            await this.writeAudit(tx, {
              rtId,
              actor,
              meta,
              action: 'APPROVAL_REQUEST_REPLAYED',
              entityType: 'transaction',
              entityId: transactionId,
              afterData: { transactionId, approvalCount: existing.length },
            });
            return this.toApprovalState(transaction, existing, policy);
          }
          const approvers = await this.findEligibleApprovers(tx, rtId, transaction, actor, policy);
          if (approvers.length < policy.requiredApprovals) {
            throw new BadRequestException('Not enough active approvers are available for this expense policy.');
          }
          const expiresAt = this.expiresAt(policy);
          await tx.expenseApproval.createMany({
            data: approvers.map((approver) => ({
              rtId,
              transactionId,
              requestedById: actor.userId,
              approverMembershipId: approver.id,
              idempotencyKey: command.idempotencyKey ? `${command.idempotencyKey}:${approver.id}` : null,
              status: ApprovalStatus.PENDING,
              reason: command.reason,
              expiresAt,
            })),
          });
          const approvals = await tx.expenseApproval.findMany({
            where: { rtId, transactionId },
            select: this.approvalSelect(),
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          });
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'APPROVAL_REQUESTED',
            entityType: 'transaction',
            entityId: transactionId,
            afterData: { transaction: this.toTransactionSummary(transaction), policy, approvalCount: approvals.length },
          });
          for (const approval of approvals) {
            await this.writeAudit(tx, {
              rtId,
              actor,
              meta,
              action: 'APPROVAL_ASSIGNED',
              entityType: 'expense_approval',
              entityId: approval.id,
              afterData: this.toApprovalRecord(approval),
            });
          }
          return this.toApprovalState(transaction, approvals, policy);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      const replay = await this.resolveApprovalRequestConflict(rtId, transactionId, policy, error);
      if (replay) {
        await this.writeAudit(this.prisma, {
          rtId,
          actor,
          meta,
          action: 'APPROVAL_REQUEST_REPLAYED',
          entityType: 'transaction',
          entityId: transactionId,
          afterData: { transactionId, approvalCount: replay.approvals.length },
        });
        return replay;
      }
      this.throwKnownConflict(error, 'Approval request could not be created because it already exists.');
    }
  }

  async decideApproval(
    rtId: string,
    approvalId: string,
    command: DecideExpenseApprovalCommand,
    actor: AuthPrincipal,
    policy: ExpenseApprovalPolicy,
    meta: ApprovalRequestMeta,
  ): Promise<ApprovalStateRecord> {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
        const before = await tx.expenseApproval.findFirst({
          where: { id: approvalId, rtId },
          select: this.approvalSelect(),
        });
        if (!before) {
          throw new BadRequestException('Approval was not found.');
        }
        if (before.status !== ApprovalStatus.PENDING) {
          throw new BadRequestException('Approval has already been finalized.');
        }
        if (before.approverMembershipId !== actor.membershipId) {
          throw new BadRequestException('Only assigned approvers can decide approvals.');
        }
        if (policy.preventSelfApproval && (before.requestedById === actor.userId || before.transaction.createdById === actor.userId)) {
          throw new BadRequestException('Self approval is not allowed by policy.');
        }
        await this.assertActiveApproverInTransaction(tx, rtId, actor.membershipId, policy);
        const decidedAt = new Date();
        const update = await tx.expenseApproval.updateMany({
          where: { id: approvalId, rtId, status: ApprovalStatus.PENDING },
          data: {
            status: command.decision,
            decisionById: actor.userId,
            decisionNote: command.decisionNote,
            decidedAt,
          },
        });
        this.assertSingleMutation(update.count);
        const after = await tx.expenseApproval.findFirstOrThrow({ where: { id: approvalId, rtId }, select: this.approvalSelect() });
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: command.decision === ApprovalStatus.APPROVED ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
          entityType: 'expense_approval',
          entityId: approvalId,
          beforeData: this.toApprovalRecord(before),
          afterData: this.toApprovalRecord(after),
        });
        if (command.decision === ApprovalStatus.REJECTED) {
          const transactionUpdate = await tx.transaction.updateMany({
            where: { id: before.transactionId, rtId, status: 'VALIDATED' as TransactionStatus, deletedAt: null },
            data: {
              status: TransactionStatus.REJECTED,
              rejectedById: actor.userId,
              rejectedAt: decidedAt,
              rejectionReason: command.decisionNote ?? 'Rejected by expense approval.',
              updatedById: actor.userId,
            },
          });
          this.assertSingleMutation(transactionUpdate.count);
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'TRANSACTION_REJECTED_BY_APPROVAL',
            entityType: 'transaction',
            entityId: before.transactionId,
            afterData: { approvalId, decisionNote: command.decisionNote },
          });
        }
        const approvals = await tx.expenseApproval.findMany({
          where: { rtId, transactionId: before.transactionId },
          select: this.approvalSelect(),
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const transaction = await tx.transaction.findFirstOrThrow({ where: { id: before.transactionId, rtId }, select: this.transactionSelect() });
        const state = this.toApprovalState(transaction, approvals, policy);
        if (state.status === 'APPROVED') {
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'APPROVAL_COMPLETED',
            entityType: 'transaction',
            entityId: before.transactionId,
            afterData: state,
          });
        }
        return state;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async cancelApproval(rtId: string, approvalId: string, command: CancelExpenseApprovalCommand, actor: AuthPrincipal, meta: ApprovalRequestMeta): Promise<ExpenseApprovalRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.expenseApproval.findFirst({ where: { id: approvalId, rtId }, select: this.approvalSelect() });
      if (!before) {
        return null;
      }
      if (before.status !== ApprovalStatus.PENDING) {
        throw new BadRequestException('Only pending approvals can be cancelled.');
      }
      const update = await tx.expenseApproval.updateMany({
        where: { id: approvalId, rtId, status: ApprovalStatus.PENDING },
        data: { status: ApprovalStatus.CANCELLED, decisionById: actor.userId, decisionNote: command.reason, decidedAt: new Date() },
      });
      this.assertSingleMutation(update.count);
      const after = await tx.expenseApproval.findFirstOrThrow({ where: { id: approvalId, rtId }, select: this.approvalSelect() });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'APPROVAL_CANCELLED',
        entityType: 'expense_approval',
        entityId: approvalId,
        beforeData: this.toApprovalRecord(before),
        afterData: this.toApprovalRecord(after),
      });
      return this.toApprovalRecord(after);
    });
  }

  private async findEligibleApprovers(
    tx: Prisma.TransactionClient,
    rtId: string,
    transaction: ApprovalTransactionDbRow,
    actor: AuthPrincipal,
    policy: ExpenseApprovalPolicy,
  ) {
    const excludedUserIds = policy.preventSelfApproval ? [...new Set([actor.userId, transaction.createdById])] : [];
    return tx.rtMembership.findMany({
      where: {
        rtId,
        status: MembershipStatus.ACTIVE,
        ...(excludedUserIds.length ? { userId: { notIn: excludedUserIds } } : {}),
        user: { status: UserStatus.ACTIVE, deletedAt: null },
        roles: {
          some: {
            role: {
              key: { in: policy.approverRoleKeys },
              deletedAt: null,
              OR: [{ rtId }, { rtId: null, isSystem: true }],
            },
          },
        },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async resolveApprovalRequestConflict(rtId: string, transactionId: string, policy: ExpenseApprovalPolicy, error: unknown): Promise<ApprovalStateRecord | null> {
    if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null;
    }
    return this.evaluateApprovalState(rtId, transactionId, policy);
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new ConflictException('Serializable approval transaction retry budget was exhausted.');
  }

  private async assertActiveApproverInTransaction(tx: Prisma.TransactionClient, rtId: string, membershipId: string, policy: ExpenseApprovalPolicy): Promise<void> {
    const membership = await tx.rtMembership.findFirst({
      where: {
        id: membershipId,
        rtId,
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE, deletedAt: null },
        roles: {
          some: {
            role: {
              key: { in: policy.approverRoleKeys },
              deletedAt: null,
              OR: [{ rtId }, { rtId: null, isSystem: true }],
            },
          },
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new BadRequestException('Active approver membership with the required role is required.');
    }
  }

  private assertValidatedExpense(transaction: ApprovalTransactionDbRow): void {
    if (transaction.type !== TransactionType.EXPENSE || transaction.status !== ('VALIDATED' as TransactionStatus)) {
      throw new BadRequestException('Only validated expense transactions can request approval.');
    }
  }

  private toApprovalState(transaction: ApprovalTransactionDbRow, approvals: ExpenseApprovalDbRow[], policy: ExpenseApprovalPolicy): ApprovalStateRecord {
    const approvedCount = approvals.filter((approval) => approval.status === ApprovalStatus.APPROVED).length;
    const pendingRows = approvals.filter((approval) => approval.status === ApprovalStatus.PENDING);
    const rejectedCount = approvals.filter((approval) => approval.status === ApprovalStatus.REJECTED).length;
    const cancelledCount = approvals.filter((approval) => approval.status === ApprovalStatus.CANCELLED).length;
    const now = Date.now();
    const status =
      rejectedCount > 0
        ? 'REJECTED'
        : approvedCount >= policy.requiredApprovals
          ? 'APPROVED'
          : pendingRows.some((approval) => approval.expiresAt && approval.expiresAt.getTime() <= now)
            ? 'EXPIRED'
            : pendingRows.length > 0 || approvals.length === 0
              ? 'PENDING'
              : cancelledCount === approvals.length
                ? 'CANCELLED'
                : 'PENDING';
    return {
      transactionId: transaction.id,
      status,
      requiredApprovals: policy.requiredApprovals,
      approvedCount,
      pendingCount: pendingRows.length,
      rejectedCount,
      approvals: approvals.map((approval) => this.toApprovalRecord(approval)),
      transaction: this.toTransactionSummary(transaction),
    };
  }

  private approvalWhere(rtId: string, query: ApprovalListQuery): Prisma.ExpenseApprovalWhereInput {
    return {
      rtId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.transactionId ? { transactionId: query.transactionId } : {}),
      ...(query.approverMembershipId ? { approverMembershipId: query.approverMembershipId } : {}),
      ...(query.search
        ? {
            OR: [
              { reason: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { decisionNote: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { transaction: { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
  }

  private approvalOrderBy(query: ApprovalListQuery): Prisma.ExpenseApprovalOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'createdAt') {
      case 'status':
        return [{ status: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ createdAt: direction }, { id: 'asc' }];
    }
  }

  private queueOrderBy(query: ApprovalQueueQuery): Prisma.ExpenseApprovalOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    return query.sortBy === 'updatedAt' ? [{ updatedAt: direction }, { id: 'asc' }] : [{ createdAt: direction }, { id: 'asc' }];
  }

  private approvalSelect() {
    return {
      id: true,
      rtId: true,
      transactionId: true,
      requestedById: true,
      approverMembershipId: true,
      decisionById: true,
      idempotencyKey: true,
      status: true,
      reason: true,
      decisionNote: true,
      expiresAt: true,
      decidedAt: true,
      createdAt: true,
      updatedAt: true,
      approverMembership: { select: { id: true, userId: true, user: { select: { fullName: true } } } },
      transaction: { select: this.transactionSelect() },
    } satisfies Prisma.ExpenseApprovalSelect;
  }

  private transactionSelect() {
    return {
      id: true,
      rtId: true,
      type: true,
      status: true,
      amount: true,
      createdById: true,
    } satisfies Prisma.TransactionSelect;
  }

  private toApprovalRecord(approval: ExpenseApprovalDbRow): ExpenseApprovalRecord {
    return {
      id: approval.id,
      rtId: approval.rtId,
      transactionId: approval.transactionId,
      requestedById: approval.requestedById,
      approverMembershipId: approval.approverMembershipId,
      decisionById: approval.decisionById,
      idempotencyKey: approval.idempotencyKey,
      status: approval.status,
      reason: approval.reason,
      decisionNote: approval.decisionNote,
      expiresAt: approval.expiresAt,
      decidedAt: approval.decidedAt,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
      approver: {
        membershipId: approval.approverMembership.id,
        userId: approval.approverMembership.userId,
        fullName: approval.approverMembership.user.fullName,
      },
      transaction: this.toTransactionSummary(approval.transaction),
    };
  }

  private toTransactionSummary(transaction: ApprovalTransactionDbRow): ApprovalTransactionSummary {
    return {
      id: transaction.id,
      rtId: transaction.rtId,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount.toString(),
      createdById: transaction.createdById,
    };
  }

  private normalizePolicy(value: unknown): ExpenseApprovalPolicy {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
    const thresholdAmount = typeof raw.thresholdAmount === 'string' ? raw.thresholdAmount : DEFAULT_EXPENSE_APPROVAL_POLICY.thresholdAmount;
    const requiredApprovals = Number.isInteger(raw.requiredApprovals) ? Number(raw.requiredApprovals) : DEFAULT_EXPENSE_APPROVAL_POLICY.requiredApprovals;
    const approverRoleKeys = Array.isArray(raw.approverRoleKeys) && raw.approverRoleKeys.every((item) => typeof item === 'string') ? raw.approverRoleKeys : DEFAULT_EXPENSE_APPROVAL_POLICY.approverRoleKeys;
    const expiresInDays = raw.expiresInDays === undefined || raw.expiresInDays === null ? undefined : Number(raw.expiresInDays);
    const normalizedExpiresInDays = Number.isFinite(expiresInDays) && expiresInDays !== undefined && expiresInDays > 0 ? expiresInDays : DEFAULT_EXPENSE_APPROVAL_POLICY.expiresInDays;
    return {
      thresholdAmount,
      autoApproveBelowThreshold: typeof raw.autoApproveBelowThreshold === 'boolean' ? raw.autoApproveBelowThreshold : DEFAULT_EXPENSE_APPROVAL_POLICY.autoApproveBelowThreshold,
      preventSelfApproval: typeof raw.preventSelfApproval === 'boolean' ? raw.preventSelfApproval : DEFAULT_EXPENSE_APPROVAL_POLICY.preventSelfApproval,
      approverRoleKeys,
      requiredApprovals: Math.max(1, requiredApprovals),
      expiresInDays: normalizedExpiresInDays,
    };
  }

  private expiresAt(policy: ExpenseApprovalPolicy): Date | null {
    if (!policy.expiresInDays) {
      return null;
    }
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + policy.expiresInDays);
    return expiresAt;
  }

  private toPaginated<T>(items: T[], page: number, limit: number, total: number): PaginatedResult<T> {
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  private assertSingleMutation(count: number): void {
    if (count !== 1) {
      throw new BadRequestException('Approval state changed while processing the request.');
    }
  }

  private async writeAudit(
    client: AuditClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: ApprovalRequestMeta;
      action: string;
      entityType: string;
      entityId?: string;
      beforeData?: unknown;
      afterData?: unknown;
    },
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        beforeData: input.beforeData === undefined ? undefined : this.toJson(input.beforeData),
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private throwKnownConflict(error: unknown, message: string): never {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
