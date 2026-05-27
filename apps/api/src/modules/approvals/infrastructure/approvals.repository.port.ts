/**
 * Purpose: Repository contract for tenant-scoped expense approval persistence.
 * Caller: ApprovalsService.
 * Deps: AuthPrincipal, approval command contracts, approval domain response types, and shared pagination.
 * MainFuncs: Defines policy, queue, detail, request, decision, cancellation, and approval-state persistence boundaries.
 * SideEffects: None in the port.
 */
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

export interface ApprovalsRepositoryPort {
  getPolicy(rtId: string): Promise<ExpenseApprovalPolicy>;
  updatePolicy(rtId: string, command: UpdateApprovalPolicyCommand, actor: AuthPrincipal, meta: ApprovalRequestMeta): Promise<ExpenseApprovalPolicy>;
  listApprovals(rtId: string, query: ApprovalListQuery): Promise<PaginatedResult<ExpenseApprovalRecord>>;
  listApprovalQueue(rtId: string, actor: AuthPrincipal, query: ApprovalQueueQuery): Promise<PaginatedResult<ExpenseApprovalRecord>>;
  findApprovalById(rtId: string, approvalId: string): Promise<ExpenseApprovalRecord | null>;
  findTransactionForApproval(rtId: string, transactionId: string): Promise<ApprovalTransactionSummary | null>;
  evaluateApprovalState(rtId: string, transactionId: string, policy: ExpenseApprovalPolicy): Promise<ApprovalStateRecord | null>;
  requestApprovals(
    rtId: string,
    transactionId: string,
    command: RequestExpenseApprovalCommand,
    actor: AuthPrincipal,
    policy: ExpenseApprovalPolicy,
    meta: ApprovalRequestMeta,
  ): Promise<ApprovalStateRecord>;
  decideApproval(
    rtId: string,
    approvalId: string,
    command: DecideExpenseApprovalCommand,
    actor: AuthPrincipal,
    policy: ExpenseApprovalPolicy,
    meta: ApprovalRequestMeta,
  ): Promise<ApprovalStateRecord>;
  cancelApproval(rtId: string, approvalId: string, command: CancelExpenseApprovalCommand, actor: AuthPrincipal, meta: ApprovalRequestMeta): Promise<ExpenseApprovalRecord | null>;
}
