/**
 * Purpose: Unit tests for Prisma Telegram repository safety around outbox tenant/status boundaries.
 * Caller: Vitest test runner.
 * Deps: PrismaTelegramRepository, mocked Prisma client, and Prisma notification/outbox enums.
 * MainFuncs: Verifies Telegram outbox claims skip invalid notifications and completion/failure transitions are aggregate-bound.
 * SideEffects: None.
 */
import { NotificationChannel, NotificationStatus, OutboxStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaTelegramRepository } from './prisma-telegram.repository';

describe('PrismaTelegramRepository', () => {
  it('does not claim Telegram outbox events for cancelled or cross-tenant notifications', async () => {
    const prisma = {
      outboxEvent: {
        findMany: vi.fn(async () => [outboxDbRow()]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      notification: {
        findFirst: vi.fn(async () => null),
      },
    };
    const repository = new PrismaTelegramRepository(prisma as never);

    const claimed = await repository.claimPendingTelegramOutbox(10);

    expect(claimed).toEqual([]);
    expect(prisma.notification.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'notification-1', rtId: 'rt-1' }) }));
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it('binds successful outbox completion to the expected notification aggregate', async () => {
    const tx = {
      outboxEvent: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: vi.fn(),
      },
      notification: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const repository = new PrismaTelegramRepository(prisma as never);

    await repository.completeTelegramOutbox('outbox-1', 'notification-1');

    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'outbox-1',
          aggregateType: 'notification',
          aggregateId: 'notification-1',
          status: OutboxStatus.PROCESSING,
        }),
      }),
    );
    expect(tx.notification.update).not.toHaveBeenCalled();
  });

  it('binds failed outbox completion to the expected notification aggregate', async () => {
    const tx = {
      outboxEvent: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        findUniqueOrThrow: vi.fn(),
      },
      notification: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const repository = new PrismaTelegramRepository(prisma as never);

    await repository.failTelegramOutbox('outbox-1', 'notification-1', 'provider failure');

    expect(tx.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'outbox-1',
          aggregateType: 'notification',
          aggregateId: 'notification-1',
          status: OutboxStatus.PROCESSING,
        }),
      }),
    );
    expect(tx.notification.update).not.toHaveBeenCalled();
  });

  it('does not resolve chat IDs for inactive linked memberships', async () => {
    const prisma = {
      telegramBinding: {
        findFirst: vi.fn(async () => ({
          telegramAccount: { telegramUserId: '1001' },
          membership: { status: 'DISABLED', user: { status: 'ACTIVE', deletedAt: null } },
          user: null,
          resident: null,
        })),
      },
    };
    const repository = new PrismaTelegramRepository(prisma as never);

    const chatId = await repository.findChatForTelegramAccount('rt-1', 'telegram-account-1');

    expect(chatId).toBeNull();
  });
});

function outboxDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'outbox-1',
    rtId: 'rt-1',
    eventType: 'NOTIFICATION_DELIVERY_REQUESTED',
    aggregateType: 'notification',
    aggregateId: 'notification-1',
    dedupeKey: 'notification:notification-1:delivery',
    payload: {
      notificationId: 'notification-1',
      rtId: 'rt-1',
      channel: NotificationChannel.TELEGRAM,
      telegramAccountId: 'telegram-account-1',
      title: 'Title',
      body: 'Body',
      payload: {},
    },
    status: OutboxStatus.PENDING,
    attempts: 0,
    availableAt: new Date('2030-01-01T00:00:00.000Z'),
    processedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function notificationDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    rtId: 'rt-1',
    channel: NotificationChannel.TELEGRAM,
    telegramAccountId: 'telegram-account-1',
    status: NotificationStatus.PENDING,
    ...overrides,
  };
}
