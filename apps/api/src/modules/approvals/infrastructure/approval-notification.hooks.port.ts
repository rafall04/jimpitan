/**
 * Purpose: Notification hook contract for approval workflow events.
 * Caller: ApprovalsService and notification adapters.
 * Deps: Approval workflow event shape.
 * MainFuncs: Defines decoupled approval requested, reminder, completed, and rejected hook methods.
 * SideEffects: None in the port.
 */
export type ApprovalWorkflowEvent = {
  rtId: string;
  transactionId: string;
  approvalId?: string;
  actorUserId: string;
  approverMembershipIds?: string[];
  status: string;
  correlationId?: string;
};

export interface ApprovalNotificationHooksPort {
  approvalRequested(event: ApprovalWorkflowEvent): Promise<void>;
  approvalReminder(event: ApprovalWorkflowEvent): Promise<void>;
  approvalCompleted(event: ApprovalWorkflowEvent): Promise<void>;
  approvalRejected(event: ApprovalWorkflowEvent): Promise<void>;
}
