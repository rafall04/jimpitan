/**
 * Purpose: Prisma persistence adapter for Telegram bot accounts, updates, bindings, sessions, audit logs, and notification outbox delivery.
 * Caller: TelegramModule provider binding and TelegramService.
 * Deps: PrismaService, Prisma enums, Telegram repository port, domain types, and command contracts.
 * MainFuncs: Performs idempotent update writes, tenant-safe binding verification, session storage, context resolution, and retry-safe outbox status transitions.
 * SideEffects: Reads and writes telegram_accounts, telegram_updates, telegram_bindings, settings, notifications, outbox_events, and audit_logs.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  MembershipStatus,
  NotificationChannel,
  NotificationStatus,
  OutboxStatus,
  Prisma,
  ResidentStatus,
  TelegramBindingStatus,
  TelegramUpdateStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateTelegramBindCodeInput, TelegramRequestMeta } from '../application/telegram.commands';
import type {
  TelegramAccountRecord,
  TelegramBindingVerificationResult,
  TelegramContextRecord,
  TelegramInboundUpdate,
  TelegramOutboxEventRecord,
  TelegramSessionRecord,
  TelegramUpdateRecord,
  TelegramUserProfile,
} from '../domain/telegram.types';
import type { TelegramRepositoryPort } from './telegram.repository.port';

type MembershipWithRoles = Prisma.RtMembershipGetPayload<{
  include: {
    rt: true;
    user: true;
    roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } };
  };
}>;

@Injectable()
export class PrismaTelegramRepository implements TelegramRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async upsertAccount(profile: TelegramUserProfile): Promise<TelegramAccountRecord> {
    const account = await this.prisma.telegramAccount.upsert({
      where: { telegramUserId: profile.telegramUserId },
      update: { username: profile.username, displayName: profile.displayName },
      create: { telegramUserId: profile.telegramUserId, username: profile.username, displayName: profile.displayName },
      select: { id: true, telegramUserId: true, username: true, displayName: true },
    });
    return account;
  }

  async recordIncomingUpdate(update: TelegramInboundUpdate, telegramAccountId: string | null): Promise<TelegramUpdateRecord> {
    try {
      const created = await this.prisma.telegramUpdate.create({
        data: {
          telegramUpdateId: BigInt(update.updateId),
          telegramAccountId,
          updateType: update.updateType,
          payload: this.toJson(update.raw),
          status: TelegramUpdateStatus.RECEIVED,
        },
        select: { id: true },
      });
      return { updateId: created.id, isDuplicate: false };
    } catch (error) {
      if (this.isUniqueError(error)) {
        const existing = await this.prisma.telegramUpdate.findUniqueOrThrow({
          where: { telegramUpdateId: BigInt(update.updateId) },
          select: { id: true },
        });
        return { updateId: existing.id, isDuplicate: true };
      }
      throw error;
    }
  }

  async markUpdateProcessed(updateId: string, context: { rtId?: string; telegramAccountId?: string | null }): Promise<void> {
    const update = await this.prisma.telegramUpdate.update({
      where: { telegramUpdateId: BigInt(updateId) },
      data: {
        rtId: context.rtId,
        telegramAccountId: context.telegramAccountId ?? undefined,
        status: TelegramUpdateStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
      select: { id: true, rtId: true, telegramAccountId: true },
    });
    await this.writeAudit({
      rtId: update.rtId,
      action: 'TELEGRAM_UPDATE_PROCESSED',
      entityType: 'telegram_update',
      entityId: update.id,
      afterData: { telegramAccountId: update.telegramAccountId },
    });
  }

  async markUpdateFailed(updateId: string, errorMessage: string, context: { rtId?: string; telegramAccountId?: string | null }): Promise<void> {
    const update = await this.prisma.telegramUpdate.update({
      where: { telegramUpdateId: BigInt(updateId) },
      data: {
        rtId: context.rtId,
        telegramAccountId: context.telegramAccountId ?? undefined,
        status: TelegramUpdateStatus.FAILED,
        processedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      },
      select: { id: true, rtId: true, telegramAccountId: true },
    });
    await this.writeAudit({
      rtId: update.rtId,
      action: 'TELEGRAM_UPDATE_FAILED',
      entityType: 'telegram_update',
      entityId: update.id,
      afterData: { telegramAccountId: update.telegramAccountId, errorMessage: errorMessage.slice(0, 500) },
    });
  }

  async getVerifiedContexts(telegramAccountId: string): Promise<TelegramContextRecord[]> {
    const bindings = await this.prisma.telegramBinding.findMany({
      where: {
        telegramAccountId,
        status: TelegramBindingStatus.VERIFIED,
        revokedAt: null,
        telegramAccount: { revokedAt: null },
        rt: { isActive: true, deletedAt: null },
      },
      select: { rtId: true, membershipId: true, userId: true, telegramAccountId: true },
      orderBy: { createdAt: 'asc' },
    });
    const contexts: TelegramContextRecord[] = [];
    for (const binding of bindings) {
      const membership = await this.resolveMembership(binding.rtId, binding.membershipId, binding.userId);
      if (!membership) {
        continue;
      }
      contexts.push(this.toContext(binding.telegramAccountId, membership));
    }
    return contexts;
  }

  async verifyBindingCode(codeHash: string, account: TelegramAccountRecord, meta: TelegramRequestMeta): Promise<TelegramBindingVerificationResult | null> {
    const verifiedRtId = await this.prisma.$transaction(async (tx) => {
      const setting = await tx.setting.findFirst({
        where: { key: `telegram_bind_code:${codeHash}` },
        select: { id: true, rtId: true, value: true },
      });
      if (!setting) {
        return null;
      }
      const value = this.objectValue(setting.value);
      const expiresAt = typeof value.expiresAt === 'string' ? new Date(value.expiresAt) : null;
      if (!expiresAt || expiresAt.getTime() <= Date.now()) {
        await tx.setting.delete({ where: { id: setting.id } });
        return null;
      }
      const membershipId = this.stringValue(value.membershipId);
      const userId = this.stringValue(value.userId);
      const residentId = this.optionalStringValue(value.residentId);
      const membership = await tx.rtMembership.findFirst({
        where: {
          id: membershipId,
          rtId: setting.rtId,
          userId,
          status: MembershipStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE, deletedAt: null },
          rt: { isActive: true, deletedAt: null },
        },
        select: { id: true, rtId: true, userId: true },
      });
      if (!membership) {
        throw new BadRequestException('Binding target is not an active same-tenant membership.');
      }
      if (residentId) {
        const resident = await tx.resident.findFirst({ where: { id: residentId, rtId: setting.rtId, deletedAt: null }, select: { id: true } });
        if (!resident) {
          throw new BadRequestException('Binding target resident is not active in this RT.');
        }
      }
      const conflict = await tx.telegramBinding.findFirst({
        where: { rtId: setting.rtId, membershipId: membership.id, telegramAccountId: { not: account.id }, status: { not: TelegramBindingStatus.REVOKED } },
        select: { id: true },
      });
      if (conflict) {
        throw new BadRequestException('Membership is already bound to another Telegram account.');
      }

      const now = new Date();
      await tx.telegramAccount.update({
        where: { id: account.id },
        data: { linkedUserId: membership.userId, verifiedAt: now, revokedAt: null },
      });
      await tx.telegramBinding.upsert({
        where: { rtId_telegramAccountId: { rtId: setting.rtId, telegramAccountId: account.id } },
        update: {
          userId: membership.userId,
          membershipId: membership.id,
          residentId: residentId ?? null,
          status: TelegramBindingStatus.VERIFIED,
          bindTokenHash: null,
          verifiedAt: now,
          revokedAt: null,
        },
        create: {
          rtId: setting.rtId,
          telegramAccountId: account.id,
          userId: membership.userId,
          membershipId: membership.id,
          residentId: residentId ?? null,
          status: TelegramBindingStatus.VERIFIED,
          verifiedAt: now,
        },
      });
      await tx.setting.delete({ where: { id: setting.id } });
      await tx.auditLog.create({
        data: {
          rtId: setting.rtId,
          actorUserId: membership.userId,
          actorType: AuditActorType.BOT,
          action: 'TELEGRAM_ACCOUNT_BOUND',
          entityType: 'telegram_account',
          entityId: account.id,
          correlationId: meta.correlationId,
          afterData: this.toJson({ membershipId: membership.id, residentId }),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
      return setting.rtId;
    });
    if (!verifiedRtId) {
      return null;
    }
    return { account, contexts: (await this.getVerifiedContexts(account.id)).filter((context) => context.rtId === verifiedRtId) };
  }

  async createBindingCode(rtId: string, input: CreateTelegramBindCodeInput, actor: AuthPrincipal, meta: TelegramRequestMeta): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.rtMembership.findFirst({
        where: {
          id: input.targetMembershipId,
          rtId,
          userId: input.targetUserId,
          status: MembershipStatus.ACTIVE,
          user: { status: UserStatus.ACTIVE, deletedAt: null },
        },
        select: { id: true, userId: true },
      });
      if (!membership) {
        throw new BadRequestException('Binding code target must be an active same-tenant membership.');
      }
      if (input.targetResidentId) {
        const resident = await tx.resident.findFirst({ where: { id: input.targetResidentId, rtId, deletedAt: null }, select: { id: true } });
        if (!resident) {
          throw new BadRequestException('Binding code resident target must belong to this RT.');
        }
      }
      await tx.setting.upsert({
        where: { rtId_key: { rtId, key: `telegram_bind_code:${input.codeHash}` } },
        update: {
          value: this.toJson({
            userId: membership.userId,
            membershipId: membership.id,
            residentId: input.targetResidentId ?? null,
            expiresAt: input.expiresAt.toISOString(),
          }),
          updatedById: actor.userId,
        },
        create: {
          rtId,
          key: `telegram_bind_code:${input.codeHash}`,
          value: this.toJson({
            userId: membership.userId,
            membershipId: membership.id,
            residentId: input.targetResidentId ?? null,
            expiresAt: input.expiresAt.toISOString(),
          }),
          updatedById: actor.userId,
        },
      });
      await tx.auditLog.create({
        data: {
          rtId,
          actorUserId: actor.userId,
          actorType: AuditActorType.USER,
          action: 'TELEGRAM_BIND_CODE_CREATED',
          entityType: 'telegram_binding',
          entityId: null,
          correlationId: meta.correlationId,
          afterData: this.toJson({ membershipId: membership.id, residentId: input.targetResidentId ?? null, expiresAt: input.expiresAt.toISOString() }),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    });
  }

  async getLatestSession(telegramAccountId: string, rtIds: string[]): Promise<{ rtId: string; session: TelegramSessionRecord } | null> {
    if (rtIds.length === 0) {
      return null;
    }
    const setting = await this.prisma.setting.findFirst({
      where: { rtId: { in: rtIds }, key: `telegram_session:${telegramAccountId}` },
      orderBy: { updatedAt: 'desc' },
      select: { rtId: true, value: true },
    });
    if (!setting) {
      return null;
    }
    const value = this.objectValue(setting.value);
    return {
      rtId: setting.rtId,
      session: {
        state: this.stringValue(value.state) as TelegramSessionRecord['state'],
        data: this.objectValue(value.data),
        updatedAt: this.optionalStringValue(value.updatedAt) ?? undefined,
      },
    };
  }

  async saveSession(rtId: string, telegramAccountId: string, userId: string, session: TelegramSessionRecord): Promise<void> {
    await this.prisma.setting.upsert({
      where: { rtId_key: { rtId, key: `telegram_session:${telegramAccountId}` } },
      update: { value: this.toJson(session), updatedById: userId },
      create: { rtId, key: `telegram_session:${telegramAccountId}`, value: this.toJson(session), updatedById: userId },
    });
  }

  async clearSession(rtId: string, telegramAccountId: string, _userId: string): Promise<void> {
    await this.prisma.setting.deleteMany({ where: { rtId, key: `telegram_session:${telegramAccountId}` } });
  }

  async claimPendingTelegramOutbox(limit: number): Promise<TelegramOutboxEventRecord[]> {
    const candidates = await this.prisma.outboxEvent.findMany({
      where: { eventType: 'NOTIFICATION_DELIVERY_REQUESTED', status: OutboxStatus.PENDING, availableAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit * 5,
    });
    const claimed: TelegramOutboxEventRecord[] = [];
    for (const event of candidates) {
      if (claimed.length >= limit) {
        break;
      }
      const payload = this.objectValue(event.payload);
      const notificationId = this.optionalStringValue(payload.notificationId);
      const telegramAccountId = this.optionalStringValue(payload.telegramAccountId);
      const payloadRtId = this.optionalStringValue(payload.rtId);
      if (
        !event.rtId ||
        event.aggregateType !== 'notification' ||
        !notificationId ||
        event.aggregateId !== notificationId ||
        payload.channel !== NotificationChannel.TELEGRAM ||
        !telegramAccountId ||
        (payloadRtId && payloadRtId !== event.rtId)
      ) {
        continue;
      }
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          rtId: event.rtId,
          channel: NotificationChannel.TELEGRAM,
          telegramAccountId,
          status: { in: [NotificationStatus.PENDING, NotificationStatus.QUEUED, NotificationStatus.FAILED] },
        },
        select: { id: true },
      });
      if (!notification) {
        continue;
      }
      const update = await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, rtId: event.rtId, aggregateType: 'notification', aggregateId: notificationId, status: OutboxStatus.PENDING },
        data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 } },
      });
      if (update.count !== 1) {
        continue;
      }
      claimed.push({
        id: event.id,
        rtId: event.rtId,
        notificationId,
        telegramAccountId,
        title: this.stringValue(payload.title),
        body: this.stringValue(payload.body),
        payload: payload.payload ?? {},
        attempts: event.attempts + 1,
      });
    }
    return claimed;
  }

  async recoverStaleTelegramOutbox(staleBefore: Date): Promise<number> {
    const updated = await this.prisma.outboxEvent.updateMany({
      where: {
        eventType: 'NOTIFICATION_DELIVERY_REQUESTED',
        status: OutboxStatus.PROCESSING,
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt: new Date(),
      },
    });
    return updated.count;
  }

  async findChatForTelegramAccount(rtId: string, telegramAccountId: string): Promise<string | null> {
    const binding = await this.prisma.telegramBinding.findFirst({
      where: { rtId, telegramAccountId, status: TelegramBindingStatus.VERIFIED, revokedAt: null, telegramAccount: { revokedAt: null } },
      select: {
        telegramAccount: { select: { telegramUserId: true } },
        membership: { select: { status: true, user: { select: { status: true, deletedAt: true } } } },
        user: {
          select: {
            status: true,
            deletedAt: true,
            memberships: { where: { rtId, status: MembershipStatus.ACTIVE }, select: { id: true }, take: 1 },
          },
        },
        resident: { select: { status: true, deletedAt: true } },
      },
    });
    if (!binding) {
      return null;
    }
    if (binding.membership && (binding.membership.status !== MembershipStatus.ACTIVE || binding.membership.user.status !== UserStatus.ACTIVE || binding.membership.user.deletedAt)) {
      return null;
    }
    if (binding.user && (binding.user.status !== UserStatus.ACTIVE || binding.user.deletedAt || binding.user.memberships.length === 0)) {
      return null;
    }
    if (binding.resident && (binding.resident.status !== ResidentStatus.ACTIVE || binding.resident.deletedAt)) {
      return null;
    }
    return binding.telegramAccount.telegramUserId;
  }

  async completeTelegramOutbox(outboxEventId: string, notificationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.outboxEvent.updateMany({
        where: { id: outboxEventId, aggregateType: 'notification', aggregateId: notificationId, status: OutboxStatus.PROCESSING },
        data: { status: OutboxStatus.PROCESSED, processedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return;
      }
      const outbox = await tx.outboxEvent.findFirstOrThrow({
        where: { id: outboxEventId, aggregateType: 'notification', aggregateId: notificationId },
        select: { id: true, rtId: true, payload: true },
      });
      if (!outbox.rtId) {
        return;
      }
      const payload = this.objectValue(outbox.payload);
      const telegramAccountId = this.optionalStringValue(payload.telegramAccountId);
      const notification = await tx.notification.findFirst({
        where: {
          id: notificationId,
          rtId: outbox.rtId,
          channel: NotificationChannel.TELEGRAM,
          ...(telegramAccountId ? { telegramAccountId } : {}),
        },
        select: { id: true, rtId: true, status: true },
      });
      if (!notification) {
        return;
      }
      if (!new Set<NotificationStatus>([NotificationStatus.PENDING, NotificationStatus.QUEUED, NotificationStatus.FAILED]).has(notification.status)) {
        return;
      }
      const updated = await tx.notification.updateMany({
        where: { id: notification.id, rtId: notification.rtId, status: notification.status },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), failedAt: null, failureReason: null },
      });
      if (updated.count !== 1) {
        return;
      }
      await tx.auditLog.create({
        data: {
          rtId: notification.rtId,
          actorType: AuditActorType.SYSTEM,
          action: 'TELEGRAM_NOTIFICATION_SENT',
          entityType: 'notification',
          entityId: notification.id,
          afterData: this.toJson({ outboxEventId: outbox.id }),
        },
      });
    });
  }

  async failTelegramOutbox(outboxEventId: string, notificationId: string, failureReason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.outboxEvent.updateMany({
        where: { id: outboxEventId, aggregateType: 'notification', aggregateId: notificationId, status: OutboxStatus.PROCESSING },
        data: { status: OutboxStatus.FAILED, availableAt: new Date(Date.now() + 5 * 60_000) },
      });
      if (claimed.count !== 1) {
        return;
      }
      const outbox = await tx.outboxEvent.findFirstOrThrow({
        where: { id: outboxEventId, aggregateType: 'notification', aggregateId: notificationId },
        select: { id: true, rtId: true, attempts: true, payload: true },
      });
      if (!outbox.rtId) {
        return;
      }
      const payload = this.objectValue(outbox.payload);
      const telegramAccountId = this.optionalStringValue(payload.telegramAccountId);
      const notification = await tx.notification.findFirst({
        where: {
          id: notificationId,
          rtId: outbox.rtId,
          channel: NotificationChannel.TELEGRAM,
          ...(telegramAccountId ? { telegramAccountId } : {}),
        },
        select: { id: true, rtId: true, status: true },
      });
      if (!notification) {
        return;
      }
      if (new Set<NotificationStatus>([NotificationStatus.SENT, NotificationStatus.CANCELLED]).has(notification.status)) {
        return;
      }
      const updated = await tx.notification.updateMany({
        where: { id: notification.id, rtId: notification.rtId, status: notification.status },
        data: { status: NotificationStatus.FAILED, failedAt: new Date(), failureReason: failureReason.slice(0, 500) },
      });
      if (updated.count !== 1) {
        return;
      }
      await tx.auditLog.create({
        data: {
          rtId: notification.rtId,
          actorType: AuditActorType.SYSTEM,
          action: 'TELEGRAM_NOTIFICATION_FAILED',
          entityType: 'notification',
          entityId: notification.id,
          afterData: this.toJson({ outboxEventId: outbox.id, attempts: outbox.attempts, failureReason: failureReason.slice(0, 500) }),
        },
      });
    });
  }

  private async resolveMembership(rtId: string, membershipId: string | null, userId: string | null): Promise<MembershipWithRoles | null> {
    return this.prisma.rtMembership.findFirst({
      where: {
        rtId,
        ...(membershipId ? { id: membershipId } : userId ? { userId } : { id: '' }),
        status: MembershipStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE, deletedAt: null },
        rt: { isActive: true, deletedAt: null },
      },
      include: {
        rt: true,
        user: true,
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
  }

  private toContext(telegramAccountId: string, membership: MembershipWithRoles): TelegramContextRecord {
    const roles = membership.roles.map((role) => role.role.key);
    const permissions = [...new Set(membership.roles.flatMap((role) => role.role.permissions.map((permission) => permission.permission.key)))];
    return {
      rtId: membership.rtId,
      rtCode: membership.rt.code,
      rtName: membership.rt.name,
      telegramAccountId,
      userId: membership.userId,
      membershipId: membership.id,
      roles,
      permissions,
    };
  }

  private async writeAudit(input: { rtId: string | null; action: string; entityType: string; entityId: string; afterData?: Record<string, unknown> }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        rtId: input.rtId,
        actorType: AuditActorType.BOT,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        afterData: input.afterData ? this.toJson(input.afterData) : undefined,
      },
    });
  }

  private objectValue(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
  }

  private stringValue(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new BadRequestException('Telegram payload is malformed.');
    }
    return value;
  }

  private optionalStringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private isUniqueError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
