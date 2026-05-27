/**
 * Purpose: Unit tests for Telegram bot webhook, command routing, state, RBAC, and outbox delivery workflows.
 * Caller: Vitest test runner.
 * Deps: TelegramService with mocked repository, sender, finance, jimpitan, approval, and config dependencies.
 * MainFuncs: Verifies idempotent update ingestion, binding safety, tenant selection, command permissions, per-house and bulk-total Jimpitan flows, and Telegram outbox retry behavior.
 * SideEffects: None.
 */
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TelegramService } from './telegram.service';

function createHarness(overrides: Record<string, any> = {}) {
  const repository = {
    upsertAccount: vi.fn(async () => telegramAccount()),
    recordIncomingUpdate: vi.fn(async () => ({ updateId: 'update-row-1', isDuplicate: false })),
    markUpdateProcessed: vi.fn(async () => undefined),
    markUpdateFailed: vi.fn(async () => undefined),
    getVerifiedContexts: vi.fn(async () => [telegramContext()]),
    verifyBindingCode: vi.fn(async () => ({ account: telegramAccount(), contexts: [telegramContext()] })),
    createBindingCode: vi.fn(async () => ({ code: 'ABC123', expiresAt: new Date('2030-01-01T01:00:00.000Z') })),
    getLatestSession: vi.fn(async () => null),
    saveSession: vi.fn(async () => undefined),
    clearSession: vi.fn(async () => undefined),
    recoverStaleTelegramOutbox: vi.fn(async () => 0),
    claimPendingTelegramOutbox: vi.fn(async () => []),
    findChatForTelegramAccount: vi.fn(async () => '1001'),
    completeTelegramOutbox: vi.fn(async () => undefined),
    failTelegramOutbox: vi.fn(async () => undefined),
    ...overrides.repository,
  } as Record<string, any>;
  const sender = {
    sendMessage: vi.fn(async () => ({ ok: true })),
    ...overrides.sender,
  } as Record<string, any>;
  const config = { get: vi.fn((key: string) => (key === 'telegram.webhookSecret' ? 'secret-1' : 'token-1')) };
  const jimpitan = {
    listMyMobileCollections: vi.fn(async () => ({ items: [collectionRecord()], page: 1, limit: 10, total: 1, totalPages: 1 })),
    getCollection: vi.fn(async () => collectionRecord()),
    getChecklist: vi.fn(async () => checklistRecord()),
    upsertCollectionItems: vi.fn(async () => collectionRecord()),
    setBulkCollectionTotal: vi.fn(async () => collectionRecord({ collectionMode: 'BULK_TOTAL', totalAmount: '75000' })),
    getSummary: vi.fn(async () => summaryRecord()),
  };
  const cashAccounts = {
    getDefaultCashAccount: vi.fn(async () => cashAccountRecord()),
    getCashAccountBalance: vi.fn(async () => ({ cashAccountId: 'cash-1', balance: '250000', ledgerSequence: 3, calculatedAt: new Date() })),
  };
  const categories = {
    listCategories: vi.fn(async () => ({ items: [categoryRecord()], page: 1, limit: 10, total: 1, totalPages: 1 })),
  };
  const transactions = {
    createIncomeDraft: vi.fn(async () => transactionRecord({ type: 'INCOME' })),
    createExpenseDraft: vi.fn(async () => transactionRecord({ type: 'EXPENSE' })),
  };
  const approvals = {
    listApprovalQueue: vi.fn(async () => ({ items: [approvalRecord()], page: 1, limit: 10, total: 1, totalPages: 1 })),
    approve: vi.fn(async () => ({ status: 'APPROVED' })),
    reject: vi.fn(async () => ({ status: 'REJECTED' })),
  };
  const service = new (TelegramService as any)(repository, sender, config, jimpitan, cashAccounts, categories, transactions, approvals);
  return { approvals, cashAccounts, categories, config, jimpitan, repository, sender, service, transactions };
}

describe('TelegramService', () => {
  it('verifies configured Telegram webhook secret before storing updates', async () => {
    const { repository, service } = createHarness();

    await expect(service.handleWebhook(webhook('/saldo'), { webhookSecret: 'wrong-secret' })).rejects.toBeInstanceOf(Error);
    expect(repository.recordIncomingUpdate).not.toHaveBeenCalled();
  });

  it('binds a Telegram account only through a verified binding code', async () => {
    const { repository, sender, service } = createHarness();

    await service.handleWebhook(webhook('/bind ABC123'), { webhookSecret: 'secret-1', correlationId: 'corr-bind' });

    expect(repository.verifyBindingCode).toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Bind berhasil') }));
  });

  it('redacts bind codes before persisting raw Telegram update payloads', async () => {
    const { repository, service } = createHarness();

    await service.handleWebhook(webhook('/bind SECRET-CODE-1'), { webhookSecret: 'secret-1' });

    expect(repository.recordIncomingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ raw: expect.objectContaining({ message: expect.objectContaining({ text: '/bind [REDACTED]' }) }) }),
      'telegram-account-1',
    );
  });

  it('prevents non-manager binding code creation for another membership', async () => {
    const { repository, service } = createHarness();
    const actor = { userId: 'user-1', membershipId: 'membership-1', rtId: 'rt-1', roles: ['WARGA'], permissions: ['telegram.bind'] };

    await expect(service.createBindingCode(actor, { userId: 'user-2', membershipId: 'membership-2' }, {})).rejects.toBeInstanceOf(Error);

    expect(repository.createBindingCode).not.toHaveBeenCalled();
  });

  it('stores incoming updates idempotently and skips duplicate processing', async () => {
    const { repository, sender, service } = createHarness({ repository: { recordIncomingUpdate: vi.fn(async () => ({ updateId: 'update-row-1', isDuplicate: true })) } });

    const result = await service.handleWebhook(webhook('/saldo'), { webhookSecret: 'secret-1', correlationId: 'corr-1' });

    expect(result.duplicate).toBe(true);
    expect(sender.sendMessage).not.toHaveBeenCalled();
    expect(repository.markUpdateProcessed).not.toHaveBeenCalled();
  });

  it('rejects unbound Telegram users before resolving tenant data', async () => {
    const { cashAccounts, sender, service } = createHarness({ repository: { getVerifiedContexts: vi.fn(async () => []) } });

    await service.handleWebhook(webhook('/saldo'), { webhookSecret: 'secret-1' });

    expect(cashAccounts.getDefaultCashAccount).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('belum terikat') }));
  });

  it('requires explicit RT selection for multi-RT users before finance reads', async () => {
    const { cashAccounts, sender, service } = createHarness({
      repository: { getVerifiedContexts: vi.fn(async () => [telegramContext(), telegramContext({ rtId: 'rt-2', rtCode: 'RT002' })]) },
    });

    await service.handleWebhook(webhook('/saldo'), { webhookSecret: 'secret-1' });

    expect(cashAccounts.getDefaultCashAccount).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('/menu RT001') }));
  });

  it('enforces RBAC for finance quick commands', async () => {
    const { cashAccounts, sender, service } = createHarness({ repository: { getVerifiedContexts: vi.fn(async () => [telegramContext({ permissions: [] })]) } });

    await service.handleWebhook(webhook('/saldo'), { webhookSecret: 'secret-1' });

    expect(cashAccounts.getDefaultCashAccount).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Akses ditolak') }));
  });

  it('rejects duplicate jimpitan house input from a Telegram flow', async () => {
    const { jimpitan, sender, service } = createHarness({
      repository: { getLatestSession: vi.fn(async () => ({ rtId: 'rt-1', session: { state: 'JIMPITAN_SELECT_HOUSE', data: { collectionId: 'collection-1', houseIds: ['house-1'] } } })) },
    });
    jimpitan.getChecklist.mockResolvedValueOnce(checklistRecord({ houses: [checklistHouse({ item: { id: 'item-1', houseId: 'house-1' } })] }));

    await service.handleWebhook(webhook('1'), { webhookSecret: 'secret-1' });

    expect(jimpitan.upsertCollectionItems).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('sudah tercatat') }));
  });

  it('validates integer currency input for expense flow', async () => {
    const { transactions, sender, service } = createHarness({
      repository: { getLatestSession: vi.fn(async () => ({ rtId: 'rt-1', session: { state: 'FINANCE_AMOUNT', data: { type: 'EXPENSE', cashAccountId: 'cash-1', categoryId: 'cat-1' } } })) },
    });

    await service.handleWebhook(webhook('10.50'), { webhookSecret: 'secret-1' });

    expect(transactions.createExpenseDraft).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('bilangan bulat') }));
  });

  it('rechecks RBAC before completing an in-progress finance flow', async () => {
    const { sender, service, transactions } = createHarness({
      repository: { getLatestSession: vi.fn(async () => ({ rtId: 'rt-1', session: { state: 'FINANCE_DESCRIPTION', data: { type: 'EXPENSE', cashAccountId: 'cash-1', categoryId: 'cat-1', amount: '10000', flowId: 'flow-1' } } })) },
    });
    service.repository.getVerifiedContexts.mockResolvedValueOnce([telegramContext({ permissions: [] })]);

    await service.handleWebhook(webhook('Belanja'), { webhookSecret: 'secret-1' });

    expect(transactions.createExpenseDraft).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Akses ditolak') }));
  });

  it('rechecks jimpitan duplicate item state immediately before final save', async () => {
    const { jimpitan, sender, service } = createHarness({
      repository: {
        getLatestSession: vi.fn(async () => ({
          rtId: 'rt-1',
          session: {
            state: 'JIMPITAN_NOTE',
            data: { collectionId: 'collection-1', houseId: 'house-1', residentId: 'resident-1', amount: '2000', status: 'PAID' },
          },
        })),
      },
    });
    jimpitan.getChecklist.mockResolvedValueOnce(checklistRecord({ houses: [checklistHouse({ item: { id: 'item-1', houseId: 'house-1' } })] }));

    await service.handleWebhook(webhook('-'), { webhookSecret: 'secret-1' });

    expect(jimpitan.upsertCollectionItems).not.toHaveBeenCalled();
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('sudah tercatat') }));
  });

  it('switches bulk total jimpitan sessions to amount-only Telegram input', async () => {
    const { jimpitan, repository, sender, service } = createHarness({
      repository: { getLatestSession: vi.fn(async () => ({ rtId: 'rt-1', session: { state: 'JIMPITAN_SELECT_SESSION', data: { collectionIds: ['collection-1'] } } })) },
    });
    jimpitan.getCollection.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL', totalAmount: '0' }));

    await service.handleWebhook(webhook('1'), { webhookSecret: 'secret-1' });

    expect(jimpitan.getChecklist).not.toHaveBeenCalled();
    expect(repository.saveSession).toHaveBeenCalledWith('rt-1', 'telegram-account-1', 'user-1', expect.objectContaining({ state: 'JIMPITAN_BULK_TOTAL_AMOUNT', data: expect.objectContaining({ collectionId: 'collection-1' }) }));
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('total terkumpul') }));
  });

  it('saves bulk total jimpitan amounts with optional notes through the safe service path', async () => {
    const { jimpitan, repository, sender, service } = createHarness({
      repository: {
        getLatestSession: vi.fn(async () => ({
          rtId: 'rt-1',
          session: { state: 'JIMPITAN_BULK_TOTAL_NOTE', data: { collectionId: 'collection-1', totalAmount: '75000' } },
        })),
      },
    });

    await service.handleWebhook(webhook('Hasil hitung akhir'), { webhookSecret: 'secret-1' });

    expect(jimpitan.setBulkCollectionTotal).toHaveBeenCalledWith(expect.objectContaining({ rtId: 'rt-1' }), 'collection-1', { totalAmount: '75000', note: 'Hasil hitung akhir' }, expect.any(Object));
    expect(repository.clearSession).toHaveBeenCalledWith('rt-1', 'telegram-account-1', 'user-1');
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Total jimpitan tersimpan') }));
  });

  it('treats repeated approval actions as idempotent bot responses', async () => {
    const { approvals, sender, service } = createHarness({
      repository: { getLatestSession: vi.fn(async () => ({ rtId: 'rt-1', session: { state: 'APPROVAL_ACTION', data: { approvalIds: ['approval-1'] } } })) },
    });
    approvals.approve.mockRejectedValueOnce(new BadRequestException('Approval has already been finalized.'));

    await service.handleWebhook(webhook('approve 1'), { webhookSecret: 'secret-1' });

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('sudah diproses') }));
  });

  it('delivers Telegram notification outbox events and records retry-safe failures', async () => {
    const { repository, sender, service } = createHarness({
      repository: { claimPendingTelegramOutbox: vi.fn(async () => [outboxEvent()]) },
      sender: { sendMessage: vi.fn(async () => ({ ok: false, errorMessage: 'telegram unavailable' })) },
    });

    const result = await service.processTelegramOutbox({ limit: 10 });

    expect(result.failed).toBe(1);
    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ chatId: '1001' }));
    expect(repository.failTelegramOutbox).toHaveBeenCalledWith('outbox-1', 'notification-1', expect.stringContaining('telegram unavailable'));
  });

  it('recovers stale Telegram outbox claims before polling pending work', async () => {
    const { repository, service } = createHarness();

    await service.processTelegramOutbox({ limit: 10, staleBefore: new Date('2030-01-01T00:00:00.000Z') });

    expect(repository.recoverStaleTelegramOutbox).toHaveBeenCalledWith(new Date('2030-01-01T00:00:00.000Z'));
    expect(repository.claimPendingTelegramOutbox).toHaveBeenCalledWith(10);
  });

  it('marks Telegram outbox delivery failed when the sender throws', async () => {
    const { repository, service } = createHarness({
      repository: { claimPendingTelegramOutbox: vi.fn(async () => [outboxEvent()]) },
      sender: { sendMessage: vi.fn(async () => {
        throw new Error('network reset');
      }) },
    });

    const result = await service.processTelegramOutbox({ limit: 10 });

    expect(result.failed).toBe(1);
    expect(repository.failTelegramOutbox).toHaveBeenCalledWith('outbox-1', 'notification-1', expect.stringContaining('network reset'));
  });
});

function webhook(text: string) {
  return {
    update_id: 10001,
    message: {
      message_id: 1,
      chat: { id: 1001 },
      from: { id: 1001, username: 'petugas', first_name: 'Petugas', last_name: 'Satu' },
      text,
    },
  };
}

function telegramAccount() {
  return { id: 'telegram-account-1', telegramUserId: '1001', username: 'petugas', displayName: 'Petugas Satu' };
}

function telegramContext(overrides: Record<string, unknown> = {}) {
  return {
    rtId: 'rt-1',
    rtCode: 'RT001',
    rtName: 'RT 001',
    telegramAccountId: 'telegram-account-1',
    userId: 'user-1',
    membershipId: 'membership-1',
    roles: ['BENDAHARA'],
    permissions: ['transactions.read', 'transactions.create', 'collections.read', 'collections.update_own', 'collections.submit_own', 'approvals.decide'],
    ...overrides,
  };
}

function collectionRecord(overrides: Record<string, unknown> = {}) {
  return { id: 'collection-1', status: 'IN_PROGRESS', collectionMode: 'PER_HOUSE', collectionDate: new Date('2030-01-01T00:00:00.000Z'), route: { areaName: 'Blok A' }, totalAmount: '0', ...overrides };
}

function checklistRecord(overrides: Record<string, unknown> = {}) {
  return { collection: collectionRecord(), houses: [checklistHouse()], ...overrides };
}

function checklistHouse(overrides: Record<string, unknown> = {}) {
  return {
    houseId: 'house-1',
    houseNumber: 'A1',
    area: { id: 'area-1', code: 'A', name: 'Blok A' },
    primaryResident: { id: 'resident-1', fullName: 'Warga Satu', defaultJimpitanAmount: '2000' },
    item: null,
    ...overrides,
  };
}

function summaryRecord() {
  return { collectionId: 'collection-1', collectionMode: 'PER_HOUSE', totalCollected: '2000', totalHouses: 1, completedHouses: 1, paidHouses: 1, outstandingHouses: 0, perArea: [] };
}

function cashAccountRecord() {
  return { id: 'cash-1', name: 'Kas RT', key: 'main', currency: 'IDR', currentBalance: '250000' };
}

function categoryRecord() {
  return { id: 'cat-1', type: 'EXPENSE', key: 'operational', name: 'Operasional' };
}

function transactionRecord(overrides: Record<string, unknown> = {}) {
  return { id: 'transaction-1', amount: '10000', status: 'DRAFT', ...overrides };
}

function approvalRecord() {
  return { id: 'approval-1', transactionId: 'transaction-1', reason: 'Need review', transaction: { amount: '100000', description: 'Belanja' } };
}

function outboxEvent() {
  return {
    id: 'outbox-1',
    rtId: 'rt-1',
    notificationId: 'notification-1',
    telegramAccountId: 'telegram-account-1',
    title: 'Approval',
    body: 'Expense needs approval',
    payload: {},
    attempts: 0,
  };
}
