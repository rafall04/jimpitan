/**
 * Purpose: Notification adapter for expense approval workflow events.
 * Caller: ApprovalsModule provider binding through ApprovalNotificationHooksPort.
 * Deps: NotificationsService, NotificationChannel enum, AuthPrincipal shape, and approval workflow event contract.
 * MainFuncs: Converts approval requested, completed, rejected, and reminder events into tenant-scoped in-app notifications with stable idempotency keys.
 * SideEffects: Writes notifications, outbox events, and notification audit logs through NotificationsService.
 */
import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NotificationsService } from '../../notifications/application/notifications.service';
import type { ApprovalNotificationHooksPort, ApprovalWorkflowEvent } from './approval-notification.hooks.port';

@Injectable()
export class ApprovalNotificationAdapter implements ApprovalNotificationHooksPort {
  constructor(private readonly notificationsService: NotificationsService) {}

  async approvalRequested(event: ApprovalWorkflowEvent): Promise<void> {
    const approverMembershipIds = [...new Set(event.approverMembershipIds ?? [])];
    if (approverMembershipIds.length === 0) {
      return undefined;
    }
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type: 'EXPENSE_APPROVAL_REQUESTED',
        title: 'Expense approval requested',
        body: 'An expense transaction is waiting for approval.',
        channels: [NotificationChannel.IN_APP],
        recipients: approverMembershipIds.map((membershipId) => ({ membershipId })),
        payload: { transactionId: event.transactionId, approvalId: event.approvalId, status: event.status },
        idempotencyKey: `approval:${event.transactionId}:requested`,
        dedupeKey: `approval:${event.transactionId}:requested`,
      },
      { correlationId: event.correlationId },
    );
  }

  async approvalReminder(event: ApprovalWorkflowEvent): Promise<void> {
    const approverMembershipIds = [...new Set(event.approverMembershipIds ?? [])];
    if (approverMembershipIds.length === 0) {
      return undefined;
    }
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type: 'EXPENSE_APPROVAL_REQUESTED',
        title: 'Expense approval reminder',
        body: 'An expense transaction approval is still pending.',
        channels: [NotificationChannel.IN_APP],
        recipients: approverMembershipIds.map((membershipId) => ({ membershipId })),
        payload: { transactionId: event.transactionId, approvalId: event.approvalId, status: event.status, reminder: true },
        idempotencyKey: `approval:${event.transactionId}:reminder`,
        dedupeKey: `approval:${event.transactionId}:reminder`,
      },
      { correlationId: event.correlationId },
    );
  }

  async approvalCompleted(event: ApprovalWorkflowEvent): Promise<void> {
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type: 'EXPENSE_APPROVED',
        title: 'Expense approved',
        body: 'An expense transaction approval has been completed.',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: event.actorUserId }],
        payload: { transactionId: event.transactionId, approvalId: event.approvalId, status: event.status },
        idempotencyKey: `approval:${event.approvalId ?? event.transactionId}:approved`,
        dedupeKey: `approval:${event.approvalId ?? event.transactionId}:approved`,
      },
      { correlationId: event.correlationId },
    );
  }

  async approvalRejected(event: ApprovalWorkflowEvent): Promise<void> {
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type: 'EXPENSE_REJECTED',
        title: 'Expense rejected',
        body: 'An expense transaction approval has been rejected.',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: event.actorUserId }],
        payload: { transactionId: event.transactionId, approvalId: event.approvalId, status: event.status },
        idempotencyKey: `approval:${event.approvalId ?? event.transactionId}:rejected`,
        dedupeKey: `approval:${event.approvalId ?? event.transactionId}:rejected`,
      },
      { correlationId: event.correlationId },
    );
  }

  private actor(event: ApprovalWorkflowEvent): AuthPrincipal {
    return {
      userId: event.actorUserId,
      membershipId: 'approval-hook',
      rtId: event.rtId,
      roles: [],
      permissions: [],
    };
  }
}
