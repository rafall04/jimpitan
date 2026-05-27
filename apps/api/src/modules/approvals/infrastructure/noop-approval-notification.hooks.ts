/**
 * Purpose: No-op notification hook implementation for approval workflow events.
 * Caller: ApprovalsModule provider binding until notification delivery is implemented.
 * Deps: ApprovalNotificationHooksPort.
 * MainFuncs: Preserves decoupled notification architecture without Telegram/UI handlers.
 * SideEffects: None.
 */
import { Injectable } from '@nestjs/common';
import type { ApprovalNotificationHooksPort, ApprovalWorkflowEvent } from './approval-notification.hooks.port';

@Injectable()
export class NoopApprovalNotificationHooks implements ApprovalNotificationHooksPort {
  async approvalRequested(_event: ApprovalWorkflowEvent): Promise<void> {
    return undefined;
  }

  async approvalReminder(_event: ApprovalWorkflowEvent): Promise<void> {
    return undefined;
  }

  async approvalCompleted(_event: ApprovalWorkflowEvent): Promise<void> {
    return undefined;
  }

  async approvalRejected(_event: ApprovalWorkflowEvent): Promise<void> {
    return undefined;
  }
}
