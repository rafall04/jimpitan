/**
 * Purpose: Command and query contracts for expense approval policies and lifecycle workflows.
 * Caller: ApprovalsController, ApprovalsService, repository ports, and notification hooks.
 * Deps: Prisma enum types and shared pagination type.
 * MainFuncs: Defines approval list filters, policy updates, request/decision commands, and audit request metadata.
 * SideEffects: None.
 */
import type { ApprovalStatus } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';
import type { ExpenseApprovalPolicy } from '../domain/approval.types';

export type ApprovalRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ApprovalSortDirection = 'asc' | 'desc';

export type ApprovalListQuery = PaginationInput & {
  status?: ApprovalStatus;
  transactionId?: string;
  approverMembershipId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status';
  sortDirection?: ApprovalSortDirection;
};

export type ApprovalQueueQuery = PaginationInput & {
  status?: Extract<ApprovalStatus, 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortDirection?: ApprovalSortDirection;
};

export type RequestExpenseApprovalCommand = {
  reason?: string;
  idempotencyKey?: string;
};

export type DecideExpenseApprovalCommand = {
  decision: Extract<ApprovalStatus, 'APPROVED' | 'REJECTED'>;
  decisionNote?: string;
};

export type ApproveExpenseApprovalCommand = {
  decisionNote?: string;
};

export type RejectExpenseApprovalCommand = {
  decisionNote: string;
};

export type CancelExpenseApprovalCommand = {
  reason: string;
};

export type UpdateApprovalPolicyCommand = ExpenseApprovalPolicy;
