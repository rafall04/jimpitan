/**
 * Purpose: Unit tests for tenant-scoped notification application workflow.
 * Caller: Vitest test runner.
 * Deps: NotificationsService, mocked notification repository, mocked delivery hooks, and AuthPrincipal.
 * MainFuncs: Verifies creation validation, tenant-scoped reads, mark-read workflows, delivery status, and retry delegation.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NotificationsService } from './notifications.service';

function createHarness() {
  const repository = {
    createNotifications: vi.fn(async () => [notificationRecord()]),
    listNotifications: vi.fn(async () => ({ items: [notificationRecord()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    listDeliveryStatus: vi.fn(async () => ({ items: [notificationRecord({ status: 'FAILED' as NotificationStatus })], page: 1, limit: 20, total: 1, totalPages: 1 })),
    findNotificationForRecipient: vi.fn(async () => notificationRecord()),
    markAsRead: vi.fn(async () => notificationRecord({ readAt: new Date('2030-01-02T00:00:00.000Z') })),
    markAllAsRead: vi.fn(async () => ({ updatedCount: 2 })),
    getUnreadCount: vi.fn(async () => 3),
    cancelNotification: vi.fn(async () => notificationRecord({ status: 'CANCELLED' as NotificationStatus })),
    retryNotificationDelivery: vi.fn(async () => notificationRecord({ status: 'PENDING' as NotificationStatus })),
    markDeliveryResult: vi.fn(async () => notificationRecord({ status: NotificationStatus.SENT, sentAt: new Date('2030-01-02T00:00:00.000Z') })),
  } as Record<string, any>;
  const principal: AuthPrincipal = {
    userId: 'user-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['notifications.read', 'notifications.manage'],
  };
  const service = new (NotificationsService as any)(repository);
  return { principal, repository, service };
}

describe('NotificationsService', () => {
  it('creates tenant-scoped notifications with recipient validation and idempotency', async () => {
    const { principal, repository, service } = createHarness();

    const result = await service.createNotifications(
      principal,
      {
        type: 'SYSTEM_ALERT',
        title: 'System',
        body: 'Maintenance',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: 'user-1' }],
        idempotencyKey: 'notif-1',
      },
      { correlationId: 'corr-1' },
    );

    expect(repository.createNotifications).toHaveBeenCalledWith('rt-1', expect.objectContaining({ idempotencyKey: 'notif-1' }), principal, { correlationId: 'corr-1' });
    expect(result[0].id).toBe('notification-1');
  });

  it('rejects creation without recipients', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createNotifications(
        principal,
        { type: 'SYSTEM_ALERT', title: 'System', body: 'Maintenance', channels: [NotificationChannel.IN_APP], recipients: [] },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createNotifications).not.toHaveBeenCalled();
  });

  it('lists current user notifications and unread counts through tenant scope', async () => {
    const { principal, repository, service } = createHarness();

    await service.listMyNotifications(principal, { page: 1, limit: 20 });
    const count = await service.getUnreadCount(principal);

    expect(repository.listNotifications).toHaveBeenCalledWith('rt-1', 'user-1', { page: 1, limit: 20 });
    expect(count).toBe(3);
  });

  it('marks one or all current user notifications as read', async () => {
    const { principal, repository, service } = createHarness();

    const one = await service.markAsRead(principal, 'notification-1', { correlationId: 'corr-2' });
    const all = await service.markAllAsRead(principal, { correlationId: 'corr-3' });

    expect(one.readAt).toBeInstanceOf(Date);
    expect(all.updatedCount).toBe(2);
    expect(repository.markAsRead).toHaveBeenCalledWith('rt-1', 'notification-1', 'user-1', principal, { correlationId: 'corr-2' });
    expect(repository.markAllAsRead).toHaveBeenCalledWith('rt-1', 'user-1', principal, { correlationId: 'corr-3' });
  });

  it('treats cross-tenant or non-recipient mark-read attempts as not found', async () => {
    const { principal, repository, service } = createHarness();
    repository.markAsRead.mockResolvedValueOnce(null);

    await expect(service.markAsRead(principal, 'outside-notification', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('manages delivery status, cancellation, and retry through admin workflows', async () => {
    const { principal, repository, service } = createHarness();

    await service.listDeliveryStatus(principal, { page: 1, limit: 20, status: 'FAILED' as NotificationStatus });
    await service.cancelNotification(principal, 'notification-1', { reason: 'Obsolete' }, { correlationId: 'corr-4' });
    await service.retryNotificationDelivery(principal, 'notification-1', { correlationId: 'corr-5' });
    await service.markDeliveryResult(principal, 'notification-1', { status: NotificationStatus.SENT }, { correlationId: 'corr-6' });

    expect(repository.listDeliveryStatus).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, status: 'FAILED' });
    expect(repository.cancelNotification).toHaveBeenCalledWith('rt-1', 'notification-1', { reason: 'Obsolete' }, principal, { correlationId: 'corr-4' });
    expect(repository.retryNotificationDelivery).toHaveBeenCalledWith('rt-1', 'notification-1', principal, { correlationId: 'corr-5' });
    expect(repository.markDeliveryResult).toHaveBeenCalledWith('rt-1', 'notification-1', { status: NotificationStatus.SENT }, principal, { correlationId: 'corr-6' });
  });
});

function notificationRecord(overrides: Record<string, unknown> = {}) {
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
