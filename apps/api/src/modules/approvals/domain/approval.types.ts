/**
 * Purpose: Domain response shapes for tenant-scoped expense approvals.
 * Caller: Approval services, repository ports, controllers, and tests.
 * Deps: Prisma enum types.
 * MainFuncs: Defines policy, approval record, transaction summary, approver summary, and derived approval state contracts.
 * SideEffects: None.
 */
import type { ApprovalStatus, TransactionStatus, TransactionType } from '@prisma/client';

export type ApprovalWorkflowStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';

export type ExpenseApprovalPolicy = {
  thresholdAmount: string;
  autoApproveBelowThreshold: boolean;
  preventSelfApproval: boolean;
  approverRoleKeys: string[];
  requiredApprovals: number;
  expiresInDays?: number;
};

export type ApprovalTransactionSummary = {
  id: string;
  rtId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  createdById: string;
};

export type ApprovalApproverSummary = {
  membershipId: string;
  userId: string;
  fullName: string;
};

export type ExpenseApprovalRecord = {
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
  approver: ApprovalApproverSummary;
  transaction: ApprovalTransactionSummary;
};

export type ApprovalStateRecord = {
  transactionId: string;
  status: ApprovalWorkflowStatus;
  requiredApprovals: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvals: ExpenseApprovalRecord[];
  transaction: ApprovalTransactionSummary;
};
