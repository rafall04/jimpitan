/**
 * Purpose: Application service for tenant-scoped notification and delivery administration workflows.
 * Caller: NotificationsController, business event adapters, future queue workers, and unit tests.
 * Deps: Notification repository port, notification command contracts, domain notification types, Prisma enums, and AuthPrincipal.
 * MainFuncs: Validates notification creation, current-user listing, unread counts, mark-read workflows, delivery status updates, cancellation, and retry delegation.
 * SideEffects: Writes notification, outbox, read-state, delivery-state, and audit changes through the repository.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NOTIFICATIONS_REPOSITORY } from '../notifications.tokens';
import type {
  CancelNotificationCommand,
  CreateNotificationCommand,
  MarkDeliveryResultCommand,
  NotificationDeliveryQuery,
  NotificationListQuery,
  NotificationRequestMeta,
} from './notifications.commands';
import { NOTIFICATION_TYPES, type MarkAllReadResult, type NotificationRecord } from '../domain/notification.types';
import type { NotificationsRepositoryPort } from '../infrastructure/notifications.repository.port';

@Injectable()
export class NotificationsService {
  constructor(@Inject(NOTIFICATIONS_REPOSITORY) private readonly repository: NotificationsRepositoryPort) {}

  async createNotifications(actor: AuthPrincipal, command: CreateNotificationCommand, meta: NotificationRequestMeta): Promise<NotificationRecord[]> {
    this.assertCreateCommand(command);
    return this.repository.createNotifications(actor.rtId, command, actor, meta);
  }

  async listMyNotifications(actor: AuthPrincipal, query: NotificationListQuery): Promise<PaginatedResult<NotificationRecord>> {
    return this.repository.listNotifications(actor.rtId, actor.userId, query);
  }

  async getUnreadCount(actor: AuthPrincipal): Promise<number> {
    return this.repository.getUnreadCount(actor.rtId, actor.userId);
  }

  async markAsRead(actor: AuthPrincipal, notificationId: string, meta: NotificationRequestMeta): Promise<NotificationRecord> {
    const notification = await this.repository.markAsRead(actor.rtId, notificationId, actor.userId, actor, meta);
    if (!notification) {
      throw new NotFoundException('Notification was not found.');
    }
    return notification;
  }

  async markAllAsRead(actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<MarkAllReadResult> {
    return this.repository.markAllAsRead(actor.rtId, actor.userId, actor, meta);
  }

  async listDeliveryStatus(actor: AuthPrincipal, query: NotificationDeliveryQuery): Promise<PaginatedResult<NotificationRecord>> {
    return this.repository.listDeliveryStatus(actor.rtId, query);
  }

  async cancelNotification(
    actor: AuthPrincipal,
    notificationId: string,
    command: CancelNotificationCommand,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord> {
    if (!command.reason?.trim()) {
      throw new BadRequestException('Cancellation reason is required.');
    }
    const notification = await this.repository.cancelNotification(actor.rtId, notificationId, command, actor, meta);
    if (!notification) {
      throw new NotFoundException('Notification was not found.');
    }
    return notification;
  }

  async retryNotificationDelivery(actor: AuthPrincipal, notificationId: string, meta: NotificationRequestMeta): Promise<NotificationRecord> {
    const notification = await this.repository.retryNotificationDelivery(actor.rtId, notificationId, actor, meta);
    if (!notification) {
      throw new NotFoundException('Notification was not found.');
    }
    return notification;
  }

  async markDeliveryResult(
    actor: AuthPrincipal,
    notificationId: string,
    command: MarkDeliveryResultCommand,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord> {
    if (command.status === NotificationStatus.FAILED && !command.failureReason?.trim()) {
      throw new BadRequestException('Failure reason is required for failed delivery.');
    }
    const notification = await this.repository.markDeliveryResult(actor.rtId, notificationId, command, actor, meta);
    if (!notification) {
      throw new NotFoundException('Notification was not found.');
    }
    return notification;
  }

  private assertCreateCommand(command: CreateNotificationCommand): void {
    if (!NOTIFICATION_TYPES.includes(command.type)) {
      throw new BadRequestException('Unsupported notification type.');
    }
    if (!command.title?.trim() || !command.body?.trim()) {
      throw new BadRequestException('Notification title and body are required.');
    }
    if (!command.recipients?.length) {
      throw new BadRequestException('At least one notification recipient is required.');
    }
    if (!command.channels?.length) {
      throw new BadRequestException('At least one notification channel is required.');
    }
    if (new Set(command.channels).size !== command.channels.length) {
      throw new BadRequestException('Duplicate notification channels are not allowed.');
    }
    for (const channel of command.channels) {
      if (![NotificationChannel.IN_APP, NotificationChannel.TELEGRAM, NotificationChannel.EMAIL].includes(channel)) {
        throw new BadRequestException('Unsupported notification channel.');
      }
    }
    for (const recipient of command.recipients) {
      const targetCount = [recipient.userId, recipient.membershipId, recipient.residentId, recipient.telegramBindingId, recipient.telegramAccountId].filter(Boolean).length;
      if (targetCount !== 1) {
        throw new BadRequestException('Each notification recipient must identify exactly one target.');
      }
    }
  }
}
