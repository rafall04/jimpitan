/**
 * Purpose: Domain response shapes and canonical type names for tenant-scoped notifications.
 * Caller: Notification services, repository ports, controllers, and business event adapters.
 * Deps: Prisma notification enums.
 * MainFuncs: Defines notification types, recipient inputs, notification records, delivery records, and mutation results.
 * SideEffects: None.
 */
import type { NotificationChannel, NotificationStatus, OutboxStatus } from '@prisma/client';

export const NOTIFICATION_TYPES = [
  'COLLECTION_ASSIGNED',
  'COLLECTION_SUBMITTED',
  'COLLECTION_VALIDATED',
  'EXPENSE_APPROVAL_REQUESTED',
  'EXPENSE_APPROVED',
  'EXPENSE_REJECTED',
  'TRANSACTION_POSTED',
  'MONTHLY_REPORT_READY',
  'SYSTEM_ALERT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationRecipientInput = {
  userId?: string;
  membershipId?: string;
  residentId?: string;
  telegramBindingId?: string;
  telegramAccountId?: string;
};

export type NotificationRecord = {
  id: string;
  rtId: string;
  recipientUserId: string | null;
  recipientResidentId: string | null;
  telegramAccountId: string | null;
  idempotencyKey: string | null;
  dedupeKey: string | null;
  channel: NotificationChannel;
  type: string;
  title: string;
  body: string;
  status: NotificationStatus;
  payload: unknown;
  failureReason: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationOutboxRecord = {
  id: string;
  rtId: string | null;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  dedupeKey: string | null;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MarkAllReadResult = {
  updatedCount: number;
};
