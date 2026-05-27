/**
 * Purpose: Command and query contracts for tenant-scoped notification workflows.
 * Caller: NotificationsController, NotificationsService, repository ports, and business event adapters.
 * Deps: Prisma notification enums and shared pagination type.
 * MainFuncs: Defines creation, delivery status, mark-read, retry, cancellation, idempotency, and audit request metadata inputs.
 * SideEffects: None.
 */
import type { NotificationChannel, NotificationStatus } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';
import type { NotificationRecipientInput, NotificationType } from '../domain/notification.types';

export type NotificationRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type NotificationSortDirection = 'asc' | 'desc';

export type NotificationListQuery = PaginationInput & {
  type?: NotificationType;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  read?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'type' | 'status';
  sortDirection?: NotificationSortDirection;
};

export type NotificationDeliveryQuery = PaginationInput & {
  type?: NotificationType;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  recipientUserId?: string;
  recipientResidentId?: string;
  telegramAccountId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'sentAt' | 'failedAt';
  sortDirection?: NotificationSortDirection;
};

export type CreateNotificationCommand = {
  type: NotificationType;
  title: string;
  body: string;
  channels: NotificationChannel[];
  recipients: NotificationRecipientInput[];
  payload?: unknown;
  idempotencyKey?: string;
  dedupeKey?: string;
};

export type CancelNotificationCommand = {
  reason: string;
};

export type MarkDeliveryResultCommand = {
  status: Extract<NotificationStatus, 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED'>;
  failureReason?: string;
};
