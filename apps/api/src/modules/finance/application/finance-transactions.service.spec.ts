/**
 * Purpose: Unit tests for tenant-scoped finance transaction lifecycle and ledger posting policy.
 * Caller: Vitest test runner.
 * Deps: FinanceTransactionsService, mocked finance repository port, AuthPrincipal.
 * MainFuncs: Verifies amount validation, lifecycle transitions, idempotency delegation, collection posting, tenant isolation, and immutable posted transaction rules.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, TransactionStatus, TransactionType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { FinanceTransactionsService } from './finance-transactions.service';

function createHarness() {
  const repository = {
    findCashAccountById: vi.fn(async () => cashAccountRecord()),
    findCategoryById: vi.fn(async () => categoryRecord({ type: TransactionType.INCOME })),
    findTransactionById: vi.fn(async () => transactionRecord()),
    createIncomeDraft: vi.fn(async () => transactionRecord({ type: TransactionType.INCOME })),
    createExpenseDraft: vi.fn(async () => transactionRecord({ type: TransactionType.EXPENSE })),
    validateTransaction: vi.fn(async () => transactionRecord({ status: 'VALIDATED' as never, validatedById: 'user-1' })),
    rejectTransaction: vi.fn(async () => transactionRecord({ status: TransactionStatus.REJECTED, rejectedById: 'user-1' })),
    voidDraftTransaction: vi.fn(async () => transactionRecord({ status: TransactionStatus.VOIDED, voidedById: 'user-1' })),
    postTransaction: vi.fn(async () => transactionRecord({ status: TransactionStatus.POSTED, postedById: 'user-1', ledger: ledgerRecord() })),
    postValidatedCollection: vi.fn(async () => ({ collectionId: 'collection-1', transaction: transactionRecord({ sourceCollectionId: 'collection-1', status: TransactionStatus.POSTED }), ledger: ledgerRecord() })),
    listTransactions: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
  };
  const principal: AuthPrincipal = {
    userId: 'user-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['transactions.read', 'transactions.create', 'transactions.validate', 'transactions.post'],
  };
  const service = new (FinanceTransactionsService as any)(repository);

  return { principal, repository, service };
}

describe('FinanceTransactionsService', () => {
  it('creates income drafts only with positive amounts, active tenant account, and matching income category', async () => {
    const { principal, repository, service } = createHarness();

    await service.createIncomeDraft(
      principal,
      { cashAccountId: 'account-1', categoryId: 'category-income', amount: '10000', description: 'Iuran', transactionDate: '2030-01-01', idempotencyKey: 'income-1' },
      { correlationId: 'corr-1' },
    );

    expect(repository.createIncomeDraft).toHaveBeenCalledWith(
      'rt-1',
      expect.objectContaining({ amount: '10000', idempotencyKey: 'income-1' }),
      principal,
      { correlationId: 'corr-1' },
    );
  });

  it('rejects non-positive transaction amounts before persistence', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createIncomeDraft(principal, { cashAccountId: 'account-1', categoryId: 'category-income', amount: '0', description: 'Bad', transactionDate: '2030-01-01' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createIncomeDraft).not.toHaveBeenCalled();
  });

  it('rejects oversized or over-precision amounts before persistence', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createIncomeDraft(principal, { cashAccountId: 'account-1', categoryId: 'category-income', amount: '1.001', description: 'Bad', transactionDate: '2030-01-01' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createIncomeDraft(principal, { cashAccountId: 'account-1', categoryId: 'category-income', amount: '1000000000000.00', description: 'Bad', transactionDate: '2030-01-01' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createIncomeDraft).not.toHaveBeenCalled();
  });

  it('blocks manual source collection attachment outside the collection posting endpoint', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createIncomeDraft(
        principal,
        { cashAccountId: 'account-1', categoryId: 'category-income', amount: '10000', description: 'Bypass', transactionDate: '2030-01-01', sourceCollectionId: 'collection-1' },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createIncomeDraft).not.toHaveBeenCalled();
  });

  it('rejects archived cash accounts and mismatched category types', async () => {
    const { principal, repository, service } = createHarness();
    repository.findCashAccountById.mockResolvedValueOnce(cashAccountRecord({ isActive: false }));

    await expect(
      service.createIncomeDraft(principal, { cashAccountId: 'account-1', categoryId: 'category-income', amount: '1000', description: 'Bad', transactionDate: '2030-01-01' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    repository.findCashAccountById.mockResolvedValueOnce(cashAccountRecord());
    repository.findCategoryById.mockResolvedValueOnce(categoryRecord({ type: TransactionType.EXPENSE }));
    await expect(
      service.createIncomeDraft(principal, { cashAccountId: 'account-1', categoryId: 'category-expense', amount: '1000', description: 'Bad', transactionDate: '2030-01-01' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates draft transactions only', async () => {
    const { principal, repository, service } = createHarness();

    await service.validateTransaction(principal, 'transaction-1', { validationNote: 'OK' }, { correlationId: 'corr-2' });

    expect(repository.validateTransaction).toHaveBeenCalledWith('rt-1', 'transaction-1', { validationNote: 'OK' }, principal, { correlationId: 'corr-2' });

    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.POSTED }));
    await expect(service.validateTransaction(principal, 'transaction-1', {}, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('posts validated transactions once and returns existing posted transaction for safe retries', async () => {
    const { principal, repository, service } = createHarness();
    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: 'VALIDATED' as never }));

    await service.postTransaction(principal, 'transaction-1', { idempotencyKey: 'post-1' }, { correlationId: 'corr-3' });

    expect(repository.postTransaction).toHaveBeenCalledWith('rt-1', 'transaction-1', { idempotencyKey: 'post-1' }, principal, { correlationId: 'corr-3' });

    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.POSTED, idempotencyKey: 'post-1', ledger: ledgerRecord() }));
    const retry = await service.postTransaction(principal, 'transaction-1', { idempotencyKey: 'post-1' }, {});
    expect(retry.status).toBe(TransactionStatus.POSTED);
    expect(repository.postTransaction).toHaveBeenCalledTimes(2);
  });

  it('rejects posting rejected or draft transactions', async () => {
    const { principal, repository, service } = createHarness();
    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.REJECTED }));

    await expect(service.postTransaction(principal, 'transaction-1', {}, {})).rejects.toBeInstanceOf(BadRequestException);

    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.DRAFT }));
    await expect(service.postTransaction(principal, 'transaction-1', {}, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents direct mutation of posted transactions', async () => {
    const { principal, repository, service } = createHarness();
    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.POSTED }));

    await expect(service.rejectTransaction(principal, 'transaction-1', { rejectionReason: 'Bad' }, {})).rejects.toBeInstanceOf(BadRequestException);

    repository.findTransactionById.mockResolvedValueOnce(transactionRecord({ status: TransactionStatus.POSTED }));
    await expect(service.voidDraftTransaction(principal, 'transaction-1', { voidReason: 'Bad' }, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps tenant isolation by treating missing scoped rows as not found', async () => {
    const { principal, repository, service } = createHarness();
    repository.findTransactionById.mockResolvedValueOnce(null as never);

    await expect(service.getTransaction(principal, 'transaction-outside')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates validated collection posting with tenant scope and idempotency key', async () => {
    const { principal, repository, service } = createHarness();

    await service.postValidatedCollection(principal, { collectionId: 'collection-1', idempotencyKey: 'collection-post-1' }, { correlationId: 'corr-4' });

    expect(repository.postValidatedCollection).toHaveBeenCalledWith('rt-1', { collectionId: 'collection-1', idempotencyKey: 'collection-post-1' }, principal, { correlationId: 'corr-4' });
  });
});

function cashAccountRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    rtId: 'rt-1',
    key: 'main',
    name: 'Kas Utama',
    currency: 'IDR',
    currentBalance: '0',
    version: 1,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function categoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'category-income',
    rtId: 'rt-1',
    type: TransactionType.INCOME,
    key: 'jimpitan',
    name: 'Jimpitan',
    isSystem: false,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function ledgerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ledger-1',
    rtId: 'rt-1',
    cashAccountId: 'account-1',
    transactionId: 'transaction-1',
    ledgerSequence: 1,
    entryType: LedgerEntryType.INCREASE,
    amount: '10000',
    balanceBefore: '0',
    balanceAfter: '10000',
    ledgerDate: new Date('2030-01-01T00:00:00.000Z'),
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function transactionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transaction-1',
    rtId: 'rt-1',
    cashAccountId: 'account-1',
    categoryId: 'category-income',
    sourceCollectionId: null,
    referenceNumber: null,
    idempotencyKey: null,
    externalRef: null,
    type: TransactionType.INCOME,
    status: TransactionStatus.DRAFT,
    amount: '10000',
    description: 'Jimpitan',
    transactionDate: new Date('2030-01-01T00:00:00.000Z'),
    createdById: 'user-1',
    updatedById: null,
    validatedById: null,
    validatedAt: null,
    validationNote: null,
    rejectedById: null,
    rejectedAt: null,
    rejectionReason: null,
    postedById: null,
    postedAt: null,
    voidedById: null,
    voidedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    cashAccount: { id: 'account-1', key: 'main', name: 'Kas Utama', currency: 'IDR' },
    category: { id: 'category-income', type: TransactionType.INCOME, key: 'jimpitan', name: 'Jimpitan' },
    ledger: null,
    ...overrides,
  };
}
