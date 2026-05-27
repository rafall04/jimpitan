/**
 * Purpose: Persistence port for tenant-scoped notification, recipient, delivery, outbox, and audit workflows.
 * Caller: NotificationsService and Prisma notification repository adapter.
 * Deps: AuthPrincipal, notification command contracts, paginated response type, and notification domain records.
 * MainFuncs: Defines notification creation, current-user reads, unread counts, read markers, delivery administration, retries, and status updates.
 * SideEffects: None in the port.
 */
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  CancelNotificationCommand,
  CreateNotificationCommand,
  MarkDeliveryResultCommand,
  NotificationDeliveryQuery,
  NotificationListQuery,
  NotificationRequestMeta,
} from '../application/notifications.commands';
import type { MarkAllReadResult, NotificationRecord } from '../domain/notification.types';

export interface NotificationsRepositoryPort {
  createNotifications(rtId: string, command: CreateNotificationCommand, actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<NotificationRecord[]>;
  listNotifications(rtId: string, recipientUserId: string, query: NotificationListQuery): Promise<PaginatedResult<NotificationRecord>>;
  listDeliveryStatus(rtId: string, query: NotificationDeliveryQuery): Promise<PaginatedResult<NotificationRecord>>;
  findNotificationForRecipient(rtId: string, notificationId: string, recipientUserId: string): Promise<NotificationRecord | null>;
  markAsRead(
    rtId: string,
    notificationId: string,
    recipientUserId: string,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null>;
  markAllAsRead(rtId: string, recipientUserId: string, actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<MarkAllReadResult>;
  getUnreadCount(rtId: string, recipientUserId: string): Promise<number>;
  cancelNotification(
    rtId: string,
    notificationId: string,
    command: CancelNotificationCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null>;
  retryNotificationDelivery(rtId: string, notificationId: string, actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<NotificationRecord | null>;
  markDeliveryResult(
    rtId: string,
    notificationId: string,
    command: MarkDeliveryResultCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null>;
}
