/**
 * Purpose: Unit tests for Prisma notification repository idempotency, recipient safety, and outbox behavior.
 * Caller: Vitest test runner.
 * Deps: PrismaNotificationsRepository, mocked Prisma client, Prisma enums, and Nest exceptions.
 * MainFuncs: Verifies duplicate replay, recipient validation, atomic outbox creation, retry state transitions, delivery transition safety, and audit gaps.
 * SideEffects: None.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, OutboxStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { PrismaNotificationsRepository } from './prisma-notifications.repository';

const actor: AuthPrincipal = {
  userId: 'user-1',
  membershipId: 'membership-1',
  rtId: 'rt-1',
  roles: ['BENDAHARA'],
  permissions: ['notifications.manage'],
};

describe('PrismaNotificationsRepository', () => {
  it('returns existing notifications for idempotent duplicate creation', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn(async () => [notificationDbRow()]),
      },
      $transaction: vi.fn(),
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    const result = await repository.createNotifications(
      'rt-1',
      {
        type: 'SYSTEM_ALERT',
        title: 'System',
        body: 'Maintenance',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: 'user-1' }],
        idempotencyKey: 'notif-1',
      },
      actor,
      { correlationId: 'corr-1' },
    );

    expect(result).toHaveLength(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'NOTIFICATION_IDEMPOTENCY_REPLAYED' }) }));
  });

  it('creates notification and outbox rows atomically for a safe recipient', async () => {
    const tx = {
      user: { findFirst: vi.fn(async () => ({ id: 'user-1' })) },
      notification: {
        create: vi.fn(async () => notificationDbRow()),
        findMany: vi.fn(async () => [notificationDbRow()]),
      },
      outboxEvent: { create: vi.fn(async () => outboxDbRow()) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      notification: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    const result = await repository.createNotifications(
      'rt-1',
      {
        type: 'SYSTEM_ALERT',
        title: 'System',
        body: 'Maintenance',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: 'user-1' }],
        dedupeKey: 'system-alert-1',
      },
      actor,
      { correlationId: 'corr-2' },
    );

    expect(result[0].status).toBe('PENDING');
    expect(tx.notification.create).toHaveBeenCalled();
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'NOTIFICATION_DELIVERY_REQUESTED' }) }));
  });

  it('rejects idempotency replay attempts that do not match the original notification payload', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn(async () => [notificationDbRow()]),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    await expect(
      repository.createNotifications(
        'rt-1',
        {
          type: 'SYSTEM_ALERT',
          title: 'Changed',
          body: 'Maintenance',
          channels: [NotificationChannel.IN_APP],
          recipients: [{ userId: 'user-1' }],
          idempotencyKey: 'notif-1',
        },
        actor,
        { correlationId: 'corr-mismatch' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'NOTIFICATION_IDEMPOTENCY_REPLAY_FAILED' }) }));
  });

  it('derives unique bounded keys for multi-recipient fanout with long idempotency bases', async () => {
    const createArgs: Array<{ data: { idempotencyKey?: string | null } }> = [];
    const tx = {
      user: {
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      },
      notification: {
        create: vi.fn(async (args: { data: Record<string, unknown> }) => {
          createArgs.push(args as { data: { idempotencyKey?: string | null } });
          return notificationDbRow({
            id: `notification-${createArgs.length}`,
            recipientUserId: args.data.recipientUserId,
            idempotencyKey: args.data.idempotencyKey,
            dedupeKey: args.data.dedupeKey,
          });
        }),
      },
      outboxEvent: { create: vi.fn(async () => outboxDbRow()) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      notification: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);
    const longKey = 'x'.repeat(120);

    await repository.createNotifications(
      'rt-1',
      {
        type: 'SYSTEM_ALERT',
        title: 'System',
        body: 'Maintenance',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: 'user-1' }, { userId: 'user-2' }],
        idempotencyKey: longKey,
      },
      actor,
      { correlationId: 'corr-long-key' },
    );

    const keys = createArgs.map((args) => args.data.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys.every((key) => typeof key === 'string' && key.length <= 120)).toBe(true);
  });

  it('rejects inactive or cross-tenant recipients before creating notifications', async () => {
    const tx = {
      user: { findFirst: vi.fn(async () => null) },
      notification: { create: vi.fn() },
      outboxEvent: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      notification: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    await expect(
      repository.createNotifications(
        'rt-1',
        { type: 'SYSTEM_ALERT', title: 'System', body: 'Maintenance', channels: [NotificationChannel.IN_APP], recipients: [{ userId: 'outside-user' }] },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('rejects telegram binding recipients whose linked user is inactive before creating in-app notifications', async () => {
    const tx = {
      telegramBinding: {
        findFirst: vi.fn(async () => ({ id: 'binding-1', userId: 'inactive-user', residentId: null, telegramAccountId: 'telegram-1' })),
      },
      user: { findFirst: vi.fn(async () => null) },
      notification: { create: vi.fn() },
      outboxEvent: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      notification: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    await expect(
      repository.createNotifications(
        'rt-1',
        { type: 'SYSTEM_ALERT', title: 'System', body: 'Maintenance', channels: [NotificationChannel.IN_APP], recipients: [{ telegramBindingId: 'binding-1' }] },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it('moves failed notifications back to pending and requeues outbox delivery', async () => {
    const failed = notificationDbRow({ status: NotificationStatus.FAILED, failureReason: 'timeout', failedAt: new Date('2030-01-02T00:00:00.000Z') });
    const tx = {
      notification: {
        findFirst: vi.fn(async () => failed),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirstOrThrow: vi.fn(async () => notificationDbRow({ status: 'PENDING' as NotificationStatus })),
      },
      outboxEvent: { create: vi.fn(async () => outboxDbRow()) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    const retried = await repository.retryNotificationDelivery('rt-1', 'notification-1', actor, { correlationId: 'corr-3' });

    expect(retried?.status).toBe('PENDING');
    expect(tx.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: NotificationStatus.FAILED }) }));
    expect(tx.outboxEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: OutboxStatus.PENDING }) }));
  });

  it('treats duplicate retry requests against already-pending notifications as safe replays', async () => {
    const pending = notificationDbRow({ status: NotificationStatus.PENDING });
    const tx = {
      notification: {
        findFirst: vi.fn(async () => pending),
      },
      outboxEvent: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    const retried = await repository.retryNotificationDelivery('rt-1', 'notification-1', actor, { correlationId: 'corr-retry-replay' });

    expect(retried?.status).toBe(NotificationStatus.PENDING);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'NOTIFICATION_RETRY_REPLAYED' }) }));
  });

  it('does not create duplicate outbox rows when a concurrent retry already moved the notification to pending', async () => {
    const failed = notificationDbRow({ status: NotificationStatus.FAILED, failureReason: 'timeout', failedAt: new Date('2030-01-02T00:00:00.000Z') });
    const pending = notificationDbRow({ status: NotificationStatus.PENDING, failureReason: null, failedAt: null });
    const tx = {
      notification: {
        findFirst: vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(pending),
        updateMany: vi.fn(async () => ({ count: 0 })),
        findFirstOrThrow: vi.fn(),
      },
      outboxEvent: { create: vi.fn() },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    const retried = await repository.retryNotificationDelivery('rt-1', 'notification-1', actor, { correlationId: 'corr-race-retry' });

    expect(retried?.status).toBe(NotificationStatus.PENDING);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'NOTIFICATION_RETRY_REPLAYED' }) }));
  });

  it('blocks unsafe delivery result transitions from sent back to failed and audits the attempt', async () => {
    const sent = notificationDbRow({ status: NotificationStatus.SENT, sentAt: new Date('2030-01-02T00:00:00.000Z') });
    const tx = {
      notification: {
        findFirst: vi.fn(async () => sent),
        updateMany: vi.fn(),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaNotificationsRepository(prisma as never);

    await expect(
      repository.markDeliveryResult('rt-1', 'notification-1', { status: NotificationStatus.FAILED, failureReason: 'late failure' }, actor, { correlationId: 'corr-blocked' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.notification.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'NOTIFICATION_STATUS_TRANSITION_BLOCKED' }) }));
  });
});

function notificationDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    rtId: 'rt-1',
    recipientUserId: 'user-1',
    recipientResidentId: null,
    telegramAccountId: null,
    idempotencyKey: 'notif-1',
    dedupeKey: 'notif:1',
    channel: NotificationChannel.IN_APP,
    type: 'SYSTEM_ALERT',
    title: 'System',
    body: 'Maintenance',
    status: 'PENDING' as NotificationStatus,
    payload: {},
    failureReason: null,
    sentAt: null,
    failedAt: null,
    readAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function outboxDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outbox-1',
    rtId: 'rt-1',
    eventType: 'NOTIFICATION_DELIVERY_REQUESTED',
    aggregateType: 'notification',
    aggregateId: 'notification-1',
    dedupeKey: 'notification:notification-1:delivery',
    payload: {},
    status: OutboxStatus.PENDING,
    attempts: 0,
    availableAt: new Date('2030-01-01T00:00:00.000Z'),
    processedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
