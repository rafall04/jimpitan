/**
 * Purpose: Prisma persistence adapter for tenant-scoped notifications, outbox delivery rows, recipient safety, and audit logs.
 * Caller: NotificationsModule dependency injection for NotificationsService.
 * Deps: PrismaService, Prisma enums/types, AuthPrincipal, notification command contracts, domain records, and repository port.
 * MainFuncs: Performs scoped notification creation, idempotency replay validation, recipient validation, inbox reads, unread counts, read markers, safe delivery status management, retries, and audit writes.
 * SideEffects: Reads and writes users, memberships, residents, telegram_bindings, notifications, outbox_events, and audit_logs.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  MembershipStatus,
  NotificationChannel,
  NotificationStatus,
  OutboxStatus,
  Prisma,
  ResidentStatus,
  TelegramBindingStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
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
import type { NotificationsRepositoryPort } from './notifications.repository.port';

type NotificationDbRow = {
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
  payload: Prisma.JsonValue;
  failureReason: string | null;
  sentAt: Date | null;
  failedAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResolvedRecipient = {
  userId: string | null;
  residentId: string | null;
  telegramAccountId: string | null;
  key: string;
};

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

type NotificationAuditInput = {
  rtId: string;
  actor: AuthPrincipal;
  meta: NotificationRequestMeta;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
};

type RetryUpdateResult = {
  notification: NotificationDbRow;
  replayed: boolean;
};

class NotificationBlockedMutation extends BadRequestException {
  constructor(
    readonly auditInput: NotificationAuditInput,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createNotifications(
    rtId: string,
    command: CreateNotificationCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord[]> {
    const replay = await this.findIdempotencyReplay(rtId, command);
    if (replay.length > 0) {
      await this.assertReplayMatches(rtId, command, replay, actor, meta);
      await this.writeAudit(this.prisma, {
        rtId,
        actor,
        meta,
        action: 'NOTIFICATION_IDEMPOTENCY_REPLAYED',
        entityType: 'notification',
        entityId: replay[0].id,
        afterData: { notificationIds: replay.map((notification) => notification.id) },
      });
      return replay.map((notification) => this.toNotificationRecord(notification));
    }

    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const recipients = await this.resolveRecipients(tx, rtId, command);
            const totalRows = recipients.length * command.channels.length;
            const created: NotificationDbRow[] = [];
            let rowIndex = 0;
            for (const recipient of recipients) {
              for (const channel of command.channels) {
                rowIndex += 1;
                this.assertChannelSupported(channel, recipient);
                const notification = await tx.notification.create({
                  data: {
                    rtId,
                    recipientUserId: recipient.userId,
                    recipientResidentId: recipient.residentId,
                    telegramAccountId: channel === NotificationChannel.TELEGRAM ? recipient.telegramAccountId : null,
                    idempotencyKey: this.derivedKey(command.idempotencyKey, channel, recipient, rowIndex, totalRows, 120),
                    dedupeKey: this.derivedKey(command.dedupeKey, channel, recipient, rowIndex, totalRows, 160),
                    channel,
                    type: command.type,
                    title: command.title.trim(),
                    body: command.body.trim(),
                    status: NotificationStatus.PENDING,
                    payload: this.toJson(command.payload ?? {}),
                  },
                  select: this.notificationSelect(),
                });
                await this.createDeliveryOutbox(tx, notification);
                const afterData = this.toNotificationRecord(notification);
                await this.writeAudit(tx, {
                  rtId,
                  actor,
                  meta,
                  action: 'NOTIFICATION_CREATED',
                  entityType: 'notification',
                  entityId: notification.id,
                  afterData,
                });
                created.push(notification);
              }
            }
            return created.map((notification) => this.toNotificationRecord(notification));
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      const replayAfterConflict = await this.resolveCreateConflict(rtId, command, actor, meta, error);
      if (replayAfterConflict) {
        return replayAfterConflict;
      }
      this.throwKnownConflict(error, 'Notification could not be created because a duplicate idempotency key, dedupe key, or outbox event exists.');
    }
  }

  async listNotifications(rtId: string, recipientUserId: string, query: NotificationListQuery): Promise<PaginatedResult<NotificationRecord>> {
    const where = this.notificationWhere(rtId, {
      ...query,
      channel: query.channel ?? NotificationChannel.IN_APP,
      recipientUserId,
    });
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: this.notificationSelect(),
        orderBy: this.notificationOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return this.toPaginated(notifications.map((notification) => this.toNotificationRecord(notification)), query.page, query.limit, total);
  }

  async listDeliveryStatus(rtId: string, query: NotificationDeliveryQuery): Promise<PaginatedResult<NotificationRecord>> {
    const where = this.notificationWhere(rtId, query);
    const [notifications, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: this.notificationSelect(),
        orderBy: this.deliveryOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return this.toPaginated(notifications.map((notification) => this.toNotificationRecord(notification)), query.page, query.limit, total);
  }

  async findNotificationForRecipient(rtId: string, notificationId: string, recipientUserId: string): Promise<NotificationRecord | null> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, rtId, recipientUserId, channel: NotificationChannel.IN_APP },
      select: this.notificationSelect(),
    });
    return notification ? this.toNotificationRecord(notification) : null;
  }

  async markAsRead(
    rtId: string,
    notificationId: string,
    recipientUserId: string,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.notification.findFirst({
        where: { id: notificationId, rtId, recipientUserId, channel: NotificationChannel.IN_APP },
        select: this.notificationSelect(),
      });
      if (!before) {
        return null;
      }
      if (before.readAt) {
        return this.toNotificationRecord(before);
      }
      const update = await tx.notification.updateMany({
        where: { id: notificationId, rtId, recipientUserId, channel: NotificationChannel.IN_APP, readAt: null },
        data: { readAt: new Date() },
      });
      this.assertSingleMutation(update.count);
      const after = await tx.notification.findFirstOrThrow({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'NOTIFICATION_READ',
        entityType: 'notification',
        entityId: notificationId,
        beforeData: this.toNotificationRecord(before),
        afterData: this.toNotificationRecord(after),
      });
      return this.toNotificationRecord(after);
    });
  }

  async markAllAsRead(rtId: string, recipientUserId: string, actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<MarkAllReadResult> {
    return this.prisma.$transaction(async (tx) => {
      const update = await tx.notification.updateMany({
        where: { rtId, recipientUserId, channel: NotificationChannel.IN_APP, readAt: null, status: { not: NotificationStatus.CANCELLED } },
        data: { readAt: new Date() },
      });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'NOTIFICATIONS_READ_ALL',
        entityType: 'notification',
        afterData: { recipientUserId, updatedCount: update.count },
      });
      return { updatedCount: update.count };
    });
  }

  async getUnreadCount(rtId: string, recipientUserId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { rtId, recipientUserId, channel: NotificationChannel.IN_APP, readAt: null, status: { not: NotificationStatus.CANCELLED } },
    });
  }

  async cancelNotification(
    rtId: string,
    notificationId: string,
    command: CancelNotificationCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.notification.findFirst({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
        if (!before) {
          return null;
        }
        if (before.status === NotificationStatus.SENT) {
          this.throwBlockedMutation(rtId, actor, meta, before, 'NOTIFICATION_STATUS_TRANSITION_BLOCKED', { attemptedStatus: NotificationStatus.CANCELLED });
        }
        if (before.status === NotificationStatus.CANCELLED) {
          return this.toNotificationRecord(before);
        }
        const cancellableStatuses = new Set<NotificationStatus>([NotificationStatus.PENDING, NotificationStatus.FAILED, NotificationStatus.QUEUED]);
        if (!cancellableStatuses.has(before.status)) {
          this.throwBlockedMutation(rtId, actor, meta, before, 'NOTIFICATION_STATUS_TRANSITION_BLOCKED', { attemptedStatus: NotificationStatus.CANCELLED });
        }
        const after = await this.updateNotificationStatus(tx, rtId, notificationId, before.status, {
          status: NotificationStatus.CANCELLED,
          failureReason: command.reason,
        });
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'NOTIFICATION_CANCELLED',
          entityType: 'notification',
          entityId: notificationId,
          beforeData: this.toNotificationRecord(before),
          afterData: this.toNotificationRecord(after),
        });
        return this.toNotificationRecord(after);
      });
    } catch (error) {
      await this.auditBlockedMutation(error);
      throw error;
    }
  }

  async retryNotificationDelivery(rtId: string, notificationId: string, actor: AuthPrincipal, meta: NotificationRequestMeta): Promise<NotificationRecord | null> {
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const before = await tx.notification.findFirst({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
            if (!before) {
              return null;
            }
            if (before.status === NotificationStatus.PENDING) {
              await this.writeAudit(tx, {
                rtId,
                actor,
                meta,
                action: 'NOTIFICATION_RETRY_REPLAYED',
                entityType: 'notification',
                entityId: notificationId,
                afterData: this.toNotificationRecord(before),
              });
              return this.toNotificationRecord(before);
            }
            if (before.status !== NotificationStatus.FAILED) {
              this.throwBlockedMutation(rtId, actor, meta, before, 'NOTIFICATION_STATUS_TRANSITION_BLOCKED', { attemptedStatus: NotificationStatus.PENDING });
            }
            const retry = await this.retryFailedNotification(tx, rtId, notificationId);
            if (retry.replayed) {
              await this.writeAudit(tx, {
                rtId,
                actor,
                meta,
                action: 'NOTIFICATION_RETRY_REPLAYED',
                entityType: 'notification',
                entityId: notificationId,
                afterData: this.toNotificationRecord(retry.notification),
              });
              return this.toNotificationRecord(retry.notification);
            }
            const after = retry.notification;
            await this.createDeliveryOutbox(tx, after, `notification:${after.id}:retry:${randomUUID()}`);
            await this.writeAudit(tx, {
              rtId,
              actor,
              meta,
              action: 'NOTIFICATION_RETRIED',
              entityType: 'notification',
              entityId: notificationId,
              beforeData: this.toNotificationRecord(before),
              afterData: this.toNotificationRecord(after),
            });
            return this.toNotificationRecord(after);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      await this.auditBlockedMutation(error);
      throw error;
    }
  }

  async markDeliveryResult(
    rtId: string,
    notificationId: string,
    command: MarkDeliveryResultCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<NotificationRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.notification.findFirst({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
        if (!before) {
          return null;
        }
        const replayableStatuses = new Set<NotificationStatus>([NotificationStatus.SENT, NotificationStatus.CANCELLED, NotificationStatus.PENDING]);
        if (before.status === command.status && replayableStatuses.has(before.status)) {
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'NOTIFICATION_DELIVERY_STATUS_REPLAYED',
            entityType: 'notification',
            entityId: notificationId,
            afterData: this.toNotificationRecord(before),
          });
          return this.toNotificationRecord(before);
        }
        if (!this.canTransitionDeliveryStatus(before.status, command.status)) {
          this.throwBlockedMutation(rtId, actor, meta, before, 'NOTIFICATION_STATUS_TRANSITION_BLOCKED', { attemptedStatus: command.status });
        }
        const now = new Date();
        const after = await this.updateNotificationStatus(tx, rtId, notificationId, before.status, {
          status: command.status,
          sentAt: command.status === NotificationStatus.SENT ? now : before.sentAt,
          failedAt: command.status === NotificationStatus.FAILED ? now : before.failedAt,
          failureReason: command.status === NotificationStatus.FAILED || command.status === NotificationStatus.CANCELLED ? command.failureReason ?? before.failureReason : null,
        });
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'NOTIFICATION_DELIVERY_STATUS_CHANGED',
          entityType: 'notification',
          entityId: notificationId,
          beforeData: this.toNotificationRecord(before),
          afterData: this.toNotificationRecord(after),
        });
        return this.toNotificationRecord(after);
      });
    } catch (error) {
      await this.auditBlockedMutation(error);
      throw error;
    }
  }

  private async findIdempotencyReplay(rtId: string, command: CreateNotificationCommand): Promise<NotificationDbRow[]> {
    const OR = this.replayWhere(command);
    if (OR.length === 0) {
      return [];
    }
    return this.prisma.notification.findMany({
      where: { rtId, OR },
      select: this.notificationSelect(),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  private async resolveCreateConflict(
    rtId: string,
    command: CreateNotificationCommand,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
    error: unknown,
  ): Promise<NotificationRecord[] | null> {
    if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return null;
    }
    const replay = await this.findIdempotencyReplay(rtId, command);
    if (replay.length === 0) {
      return null;
    }
    await this.writeAudit(this.prisma, {
      rtId,
      actor,
      meta,
      action: 'NOTIFICATION_IDEMPOTENCY_REPLAYED',
      entityType: 'notification',
      entityId: replay[0].id,
      afterData: { notificationIds: replay.map((notification) => notification.id), conflictResolved: true },
    });
    return replay.map((notification) => this.toNotificationRecord(notification));
  }

  private async resolveRecipients(tx: Prisma.TransactionClient, rtId: string, command: CreateNotificationCommand): Promise<ResolvedRecipient[]> {
    const needsTelegram = command.channels.includes(NotificationChannel.TELEGRAM);
    const recipients: ResolvedRecipient[] = [];
    const seen = new Set<string>();
    for (const recipient of command.recipients) {
      const resolved = recipient.userId
        ? await this.resolveUserRecipient(tx, rtId, recipient.userId, needsTelegram)
        : recipient.membershipId
          ? await this.resolveMembershipRecipient(tx, rtId, recipient.membershipId, needsTelegram)
          : recipient.residentId
            ? await this.resolveResidentRecipient(tx, rtId, recipient.residentId, needsTelegram)
            : recipient.telegramBindingId
              ? await this.resolveTelegramBindingRecipient(tx, rtId, recipient.telegramBindingId)
              : recipient.telegramAccountId
                ? await this.resolveTelegramAccountRecipient(tx, rtId, recipient.telegramAccountId)
                : null;
      if (!resolved) {
        throw new BadRequestException('Notification recipient must be active and belong to the current tenant.');
      }
      if (!seen.has(resolved.key)) {
        seen.add(resolved.key);
        recipients.push(resolved);
      }
    }
    if (recipients.length === 0) {
      throw new BadRequestException('At least one active notification recipient is required.');
    }
    return recipients;
  }

  private async resolveUserRecipient(tx: Prisma.TransactionClient, rtId: string, userId: string, needsTelegram: boolean): Promise<ResolvedRecipient | null> {
    const user = await tx.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null, memberships: { some: { rtId, status: MembershipStatus.ACTIVE } } },
      select: { id: true },
    });
    if (!user) {
      return null;
    }
    return { userId: user.id, residentId: null, telegramAccountId: needsTelegram ? await this.findTelegramAccountForUser(tx, rtId, user.id) : null, key: `user:${user.id}` };
  }

  private async resolveMembershipRecipient(tx: Prisma.TransactionClient, rtId: string, membershipId: string, needsTelegram: boolean): Promise<ResolvedRecipient | null> {
    const membership = await tx.rtMembership.findFirst({
      where: { id: membershipId, rtId, status: MembershipStatus.ACTIVE, user: { status: UserStatus.ACTIVE, deletedAt: null } },
      select: { id: true, userId: true },
    });
    if (!membership) {
      return null;
    }
    return {
      userId: membership.userId,
      residentId: null,
      telegramAccountId: needsTelegram ? await this.findTelegramAccountForMembership(tx, rtId, membership.id) : null,
      key: `membership:${membership.id}`,
    };
  }

  private async resolveResidentRecipient(tx: Prisma.TransactionClient, rtId: string, residentId: string, needsTelegram: boolean): Promise<ResolvedRecipient | null> {
    const resident = await tx.resident.findFirst({
      where: { id: residentId, rtId, status: ResidentStatus.ACTIVE, deletedAt: null },
      select: { id: true },
    });
    if (!resident) {
      return null;
    }
    return { userId: null, residentId: resident.id, telegramAccountId: needsTelegram ? await this.findTelegramAccountForResident(tx, rtId, resident.id) : null, key: `resident:${resident.id}` };
  }

  private async resolveTelegramBindingRecipient(tx: Prisma.TransactionClient, rtId: string, telegramBindingId: string): Promise<ResolvedRecipient | null> {
    const binding = await tx.telegramBinding.findFirst({
      where: { id: telegramBindingId, rtId, status: TelegramBindingStatus.VERIFIED, revokedAt: null, telegramAccount: { revokedAt: null } },
      select: { id: true, userId: true, membershipId: true, residentId: true, telegramAccountId: true },
    });
    if (!binding) {
      return null;
    }
    return this.resolveLinkedTelegramRecipient(tx, rtId, binding, `telegram-binding:${binding.id}`);
  }

  private async resolveTelegramAccountRecipient(tx: Prisma.TransactionClient, rtId: string, telegramAccountId: string): Promise<ResolvedRecipient | null> {
    const binding = await tx.telegramBinding.findFirst({
      where: { rtId, telegramAccountId, status: TelegramBindingStatus.VERIFIED, revokedAt: null, telegramAccount: { revokedAt: null } },
      select: { userId: true, membershipId: true, residentId: true, telegramAccountId: true },
    });
    if (!binding) {
      return null;
    }
    return this.resolveLinkedTelegramRecipient(tx, rtId, binding, `telegram-account:${binding.telegramAccountId}`);
  }

  private async findTelegramAccountForUser(tx: Prisma.TransactionClient, rtId: string, userId: string): Promise<string | null> {
    const binding = await tx.telegramBinding.findFirst({
      where: {
        rtId,
        status: TelegramBindingStatus.VERIFIED,
        revokedAt: null,
        telegramAccount: { revokedAt: null },
        OR: [{ userId }, { membership: { userId, status: MembershipStatus.ACTIVE } }],
      },
      select: { telegramAccountId: true },
    });
    return binding?.telegramAccountId ?? null;
  }

  private async findTelegramAccountForMembership(tx: Prisma.TransactionClient, rtId: string, membershipId: string): Promise<string | null> {
    const membership = await tx.rtMembership.findFirst({
      where: { id: membershipId, rtId, status: MembershipStatus.ACTIVE, user: { status: UserStatus.ACTIVE, deletedAt: null } },
      select: { userId: true },
    });
    if (!membership) {
      return null;
    }
    const binding = await tx.telegramBinding.findFirst({
      where: {
        rtId,
        status: TelegramBindingStatus.VERIFIED,
        revokedAt: null,
        telegramAccount: { revokedAt: null },
        OR: [{ membershipId }, { userId: membership.userId }],
      },
      select: { telegramAccountId: true },
    });
    return binding?.telegramAccountId ?? null;
  }

  private async findTelegramAccountForResident(tx: Prisma.TransactionClient, rtId: string, residentId: string): Promise<string | null> {
    const binding = await tx.telegramBinding.findFirst({
      where: { rtId, residentId, status: TelegramBindingStatus.VERIFIED, revokedAt: null, telegramAccount: { revokedAt: null } },
      select: { telegramAccountId: true },
    });
    return binding?.telegramAccountId ?? null;
  }

  private async resolveLinkedTelegramRecipient(
    tx: Prisma.TransactionClient,
    rtId: string,
    binding: { userId: string | null; membershipId?: string | null; residentId: string | null; telegramAccountId: string },
    key: string,
  ): Promise<ResolvedRecipient | null> {
    if (binding.membershipId) {
      const membership = await tx.rtMembership.findFirst({
        where: { id: binding.membershipId, rtId, status: MembershipStatus.ACTIVE, user: { status: UserStatus.ACTIVE, deletedAt: null } },
        select: { userId: true },
      });
      if (!membership) {
        return null;
      }
      return { userId: membership.userId, residentId: null, telegramAccountId: binding.telegramAccountId, key };
    }
    if (binding.userId) {
      const user = await tx.user.findFirst({
        where: { id: binding.userId, status: UserStatus.ACTIVE, deletedAt: null, memberships: { some: { rtId, status: MembershipStatus.ACTIVE } } },
        select: { id: true },
      });
      if (!user) {
        return null;
      }
      return { userId: user.id, residentId: null, telegramAccountId: binding.telegramAccountId, key };
    }
    if (binding.residentId) {
      const resident = await tx.resident.findFirst({
        where: { id: binding.residentId, rtId, status: ResidentStatus.ACTIVE, deletedAt: null },
        select: { id: true },
      });
      if (!resident) {
        return null;
      }
      return { userId: null, residentId: resident.id, telegramAccountId: binding.telegramAccountId, key };
    }
    return { userId: null, residentId: null, telegramAccountId: binding.telegramAccountId, key };
  }

  private assertChannelSupported(channel: NotificationChannel, recipient: ResolvedRecipient): void {
    if (channel === NotificationChannel.TELEGRAM && !recipient.telegramAccountId) {
      throw new BadRequestException('Verified Telegram binding is required for Telegram notifications.');
    }
    if (channel === NotificationChannel.IN_APP && !recipient.userId && !recipient.residentId) {
      throw new BadRequestException('In-app notifications require a user or resident recipient.');
    }
    if (channel === NotificationChannel.EMAIL && !recipient.userId) {
      throw new BadRequestException('Email notifications require an active user recipient.');
    }
  }

  private async createDeliveryOutbox(tx: Prisma.TransactionClient, notification: NotificationDbRow, dedupeKey?: string): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        rtId: notification.rtId,
        eventType: 'NOTIFICATION_DELIVERY_REQUESTED',
        aggregateType: 'notification',
        aggregateId: notification.id,
        dedupeKey: dedupeKey ?? `notification:${notification.id}:delivery`,
        payload: this.toJson({
          notificationId: notification.id,
          rtId: notification.rtId,
          channel: notification.channel,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          recipientUserId: notification.recipientUserId,
          recipientResidentId: notification.recipientResidentId,
          telegramAccountId: notification.telegramAccountId,
          payload: notification.payload,
        }),
        status: OutboxStatus.PENDING,
        attempts: 0,
      },
    });
  }

  private async updateNotificationStatus(
    tx: Prisma.TransactionClient,
    rtId: string,
    notificationId: string,
    expectedStatus: NotificationStatus,
    data: Prisma.NotificationUpdateManyMutationInput,
  ): Promise<NotificationDbRow> {
    const update = await tx.notification.updateMany({ where: { id: notificationId, rtId, status: expectedStatus }, data });
    this.assertSingleMutation(update.count);
    return tx.notification.findFirstOrThrow({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
  }

  private notificationWhere(
    rtId: string,
    query: NotificationListQuery | NotificationDeliveryQuery,
  ): Prisma.NotificationWhereInput {
    const readFilter = 'read' in query && query.read !== undefined ? { readAt: query.read ? { not: null } : null } : {};
    return {
      rtId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...('recipientUserId' in query && query.recipientUserId ? { recipientUserId: query.recipientUserId } : {}),
      ...('recipientResidentId' in query && query.recipientResidentId ? { recipientResidentId: query.recipientResidentId } : {}),
      ...('telegramAccountId' in query && query.telegramAccountId ? { telegramAccountId: query.telegramAccountId } : {}),
      ...readFilter,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { body: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { type: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };
  }

  private replayWhere(command: CreateNotificationCommand): Prisma.NotificationWhereInput[] {
    const OR: Prisma.NotificationWhereInput[] = [];
    if (command.idempotencyKey) {
      OR.push({ idempotencyKey: command.idempotencyKey }, { idempotencyKey: { startsWith: `${command.idempotencyKey}:` } });
    }
    if (command.dedupeKey) {
      OR.push({ dedupeKey: command.dedupeKey }, { dedupeKey: { startsWith: `${command.dedupeKey}:` } });
    }
    return OR;
  }

  private notificationOrderBy(query: NotificationListQuery): Prisma.NotificationOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'createdAt') {
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'type':
        return [{ type: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ createdAt: direction }, { id: 'asc' }];
    }
  }

  private deliveryOrderBy(query: NotificationDeliveryQuery): Prisma.NotificationOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'createdAt') {
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'sentAt':
        return [{ sentAt: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'failedAt':
        return [{ failedAt: direction }, { createdAt: 'desc' }, { id: 'asc' }];
      case 'createdAt':
      default:
        return [{ createdAt: direction }, { id: 'asc' }];
    }
  }

  private notificationSelect() {
    return {
      id: true,
      rtId: true,
      recipientUserId: true,
      recipientResidentId: true,
      telegramAccountId: true,
      idempotencyKey: true,
      dedupeKey: true,
      channel: true,
      type: true,
      title: true,
      body: true,
      status: true,
      payload: true,
      failureReason: true,
      sentAt: true,
      failedAt: true,
      readAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.NotificationSelect;
  }

  private toNotificationRecord(notification: NotificationDbRow): NotificationRecord {
    return {
      id: notification.id,
      rtId: notification.rtId,
      recipientUserId: notification.recipientUserId,
      recipientResidentId: notification.recipientResidentId,
      telegramAccountId: notification.telegramAccountId,
      idempotencyKey: notification.idempotencyKey,
      dedupeKey: notification.dedupeKey,
      channel: notification.channel,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      status: notification.status,
      payload: notification.payload,
      failureReason: notification.failureReason,
      sentAt: notification.sentAt,
      failedAt: notification.failedAt,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  private toPaginated<T>(items: T[], page: number, limit: number, total: number): PaginatedResult<T> {
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  private assertSingleMutation(count: number): void {
    if (count !== 1) {
      throw new BadRequestException('Notification state changed while processing the request.');
    }
  }

  private derivedKey(base: string | undefined, channel: NotificationChannel, recipient: ResolvedRecipient, rowIndex: number, totalRows: number, maxLength: number): string | null {
    if (!base) {
      return null;
    }
    if (totalRows === 1) {
      return base.slice(0, maxLength);
    }
    const suffix = `:${channel}:${rowIndex}:${createHash('sha256').update(recipient.key).digest('hex').slice(0, 12)}`;
    const baseLength = Math.max(1, maxLength - suffix.length);
    return `${base.slice(0, baseLength)}${suffix}`.slice(0, maxLength);
  }

  private async retryFailedNotification(tx: Prisma.TransactionClient, rtId: string, notificationId: string): Promise<RetryUpdateResult> {
    const update = await tx.notification.updateMany({
      where: { id: notificationId, rtId, status: NotificationStatus.FAILED },
      data: { status: NotificationStatus.PENDING, failureReason: null, failedAt: null, sentAt: null },
    });
    if (update.count !== 1) {
      const current = await tx.notification.findFirst({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
      if (current?.status === NotificationStatus.PENDING) {
        return { notification: current, replayed: true };
      }
      this.assertSingleMutation(update.count);
    }
    const notification = await tx.notification.findFirstOrThrow({ where: { id: notificationId, rtId }, select: this.notificationSelect() });
    return { notification, replayed: false };
  }

  private canTransitionDeliveryStatus(current: NotificationStatus, next: NotificationStatus): boolean {
    if (current === NotificationStatus.PENDING || current === NotificationStatus.QUEUED) {
      return next === NotificationStatus.PENDING || next === NotificationStatus.SENT || next === NotificationStatus.FAILED || next === NotificationStatus.CANCELLED;
    }
    if (current === NotificationStatus.FAILED) {
      return next === NotificationStatus.FAILED || next === NotificationStatus.CANCELLED;
    }
    if (current === NotificationStatus.SENT) {
      return next === NotificationStatus.SENT;
    }
    if (current === NotificationStatus.CANCELLED) {
      return next === NotificationStatus.CANCELLED;
    }
    return false;
  }

  private async assertReplayMatches(
    rtId: string,
    command: CreateNotificationCommand,
    replay: NotificationDbRow[],
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
  ): Promise<void> {
    if (this.replayMatches(command, replay)) {
      return;
    }
    await this.writeAudit(this.prisma, {
      rtId,
      actor,
      meta,
      action: 'NOTIFICATION_IDEMPOTENCY_REPLAY_FAILED',
      entityType: 'notification',
      entityId: replay[0]?.id,
      afterData: {
        requested: this.replayFingerprint(command),
        existing: replay.map((notification) => this.notificationReplayFingerprint(notification)),
      },
    });
    throw new ConflictException('Idempotency replay does not match the original notification request.');
  }

  private replayMatches(command: CreateNotificationCommand, replay: NotificationDbRow[]): boolean {
    if (replay.length !== this.expectedReplayRowCount(command)) {
      return false;
    }
    const expectedChannels = [...new Set(command.channels)].sort();
    const actualChannels = [...new Set(replay.map((notification) => notification.channel))].sort();
    const directUserIds = command.recipients.map((recipient) => recipient.userId).filter((value): value is string => Boolean(value)).sort();
    const directResidentIds = command.recipients.map((recipient) => recipient.residentId).filter((value): value is string => Boolean(value)).sort();
    const directTelegramAccountIds = command.recipients.map((recipient) => recipient.telegramAccountId).filter((value): value is string => Boolean(value)).sort();
    const replayUserIds = replay.map((notification) => notification.recipientUserId).filter((value): value is string => Boolean(value)).sort();
    const replayResidentIds = replay.map((notification) => notification.recipientResidentId).filter((value): value is string => Boolean(value)).sort();
    const replayTelegramAccountIds = replay.map((notification) => notification.telegramAccountId).filter((value): value is string => Boolean(value)).sort();
    return (
      replay.every((notification) => notification.type === command.type && notification.title === command.title.trim() && notification.body === command.body.trim()) &&
      this.sameStringArray(expectedChannels, actualChannels) &&
      this.sameJson(command.payload ?? {}, replay[0]?.payload ?? {}) &&
      (directUserIds.length === 0 || this.sameStringArray([...new Set(directUserIds)], [...new Set(replayUserIds)])) &&
      (directResidentIds.length === 0 || this.sameStringArray([...new Set(directResidentIds)], [...new Set(replayResidentIds)])) &&
      (directTelegramAccountIds.length === 0 || this.sameStringArray([...new Set(directTelegramAccountIds)], [...new Set(replayTelegramAccountIds)]))
    );
  }

  private expectedReplayRowCount(command: CreateNotificationCommand): number {
    const recipientKeys = command.recipients.map((recipient) => {
      if (recipient.userId) {
        return `user:${recipient.userId}`;
      }
      if (recipient.membershipId) {
        return `membership:${recipient.membershipId}`;
      }
      if (recipient.residentId) {
        return `resident:${recipient.residentId}`;
      }
      if (recipient.telegramBindingId) {
        return `telegram-binding:${recipient.telegramBindingId}`;
      }
      return `telegram-account:${recipient.telegramAccountId ?? ''}`;
    });
    return new Set(recipientKeys).size * new Set(command.channels).size;
  }

  private replayFingerprint(command: CreateNotificationCommand): Record<string, unknown> {
    return {
      type: command.type,
      title: command.title.trim(),
      body: command.body.trim(),
      channels: [...new Set(command.channels)].sort(),
      payload: command.payload ?? {},
      recipients: command.recipients,
    };
  }

  private notificationReplayFingerprint(notification: NotificationDbRow): Record<string, unknown> {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      channel: notification.channel,
      payload: notification.payload,
      recipientUserId: notification.recipientUserId,
      recipientResidentId: notification.recipientResidentId,
      telegramAccountId: notification.telegramAccountId,
    };
  }

  private sameStringArray(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  private sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
  }

  private throwBlockedMutation(
    rtId: string,
    actor: AuthPrincipal,
    meta: NotificationRequestMeta,
    notification: NotificationDbRow,
    action: string,
    afterData: Record<string, unknown>,
  ): never {
    throw new NotificationBlockedMutation(
      {
        rtId,
        actor,
        meta,
        action,
        entityType: 'notification',
        entityId: notification.id,
        beforeData: this.toNotificationRecord(notification),
        afterData: { ...afterData, currentStatus: notification.status },
      },
      'Notification status transition is not allowed.',
    );
  }

  private async auditBlockedMutation(error: unknown): Promise<void> {
    if (error instanceof NotificationBlockedMutation) {
      await this.writeAudit(this.prisma, error.auditInput);
    }
  }

  private async writeAudit(client: AuditClient, input: NotificationAuditInput): Promise<void> {
    await client.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        beforeData: input.beforeData === undefined ? undefined : this.toJson(input.beforeData),
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new ConflictException('Serializable notification transaction retry budget was exhausted.');
  }

  private throwKnownConflict(error: unknown, message: string): never {
    if (error instanceof PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
