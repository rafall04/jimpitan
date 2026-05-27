/**
 * Purpose: Unit tests for Prisma finance repository financial safety edge cases.
 * Caller: Vitest test runner.
 * Deps: PrismaFinanceRepository, mocked Prisma client, Prisma enums, and Nest exceptions.
 * MainFuncs: Verifies idempotency race recovery, replay rejection, source collection duplicate safety, and mode-aware collection posting.
 * SideEffects: None.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CollectionMode, CollectionStatus, LedgerEntryType, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { PrismaFinanceRepository } from './prisma-finance.repository';

const actor: AuthPrincipal = {
  userId: 'user-1',
  membershipId: 'membership-1',
  rtId: 'rt-1',
  roles: ['BENDAHARA'],
  permissions: ['transactions.post'],
};

describe('PrismaFinanceRepository safety edges', () => {
  it('returns the existing transaction when a concurrent create wins the same idempotency key', async () => {
    const existing = transactionDbRow({ idempotencyKey: 'draft-1' });
    const prisma = {
      transaction: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
      },
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async () => {
        throw knownPrismaError('P2002', ['rt_id', 'idempotency_key']);
      }),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    const result = await repository.createIncomeDraft(
      'rt-1',
      {
        cashAccountId: 'account-1',
        categoryId: 'category-income',
        amount: '10000',
        description: 'Jimpitan',
        transactionDate: '2030-01-01',
        idempotencyKey: 'draft-1',
      },
      actor,
      { correlationId: 'corr-1' },
    );

    expect(result.id).toBe('transaction-1');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FINANCE_IDEMPOTENCY_REPLAYED' }) }));
  });

  it('rejects posted transaction replay with a different idempotency key and writes an audit log outside the rolled back transaction', async () => {
    const posted = transactionDbRow({ status: TransactionStatus.POSTED, idempotencyKey: 'post-1', postedAt: new Date('2030-01-02T00:00:00.000Z'), ledger: ledgerDbRow() });
    const tx = {
      transaction: { findFirst: vi.fn(async () => posted) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    await expect(repository.postTransaction('rt-1', 'transaction-1', { idempotencyKey: 'post-2' }, actor, { correlationId: 'corr-2' })).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED' }) }));
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate collection posting when the source collection matches but the idempotency key does not', async () => {
    const existing = transactionDbRow({
      sourceCollectionId: 'collection-1',
      status: TransactionStatus.POSTED,
      idempotencyKey: 'collection:collection-1',
      postedAt: new Date('2030-01-02T00:00:00.000Z'),
      ledger: ledgerDbRow(),
    });
    const tx = {
      transaction: { findFirst: vi.fn(async () => existing) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    await expect(
      repository.postValidatedCollection('rt-1', { collectionId: 'collection-1', idempotencyKey: 'manual-replay' }, actor, { correlationId: 'corr-3' }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED' }) }));
  });

  it('posts bulk total collections from the validated collection total without item aggregation', async () => {
    const transaction = transactionDbRow({ sourceCollectionId: 'collection-1', amount: new Prisma.Decimal('75000'), status: 'VALIDATED' as TransactionStatus });
    const posted = transactionDbRow({
      sourceCollectionId: 'collection-1',
      amount: new Prisma.Decimal('75000'),
      status: TransactionStatus.POSTED,
      idempotencyKey: 'collection:collection-1',
      ledger: ledgerDbRow({ amount: new Prisma.Decimal('75000'), balanceAfter: new Prisma.Decimal('175000') }),
    });
    const tx = {
      transaction: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(posted),
        create: vi.fn(async () => transaction),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      jimpitanCollection: {
        findFirst: vi.fn(async () => ({
          id: 'collection-1',
          rtId: 'rt-1',
          collectionMode: CollectionMode.BULK_TOTAL,
          status: CollectionStatus.VALIDATED,
          totalAmount: new Prisma.Decimal('75000'),
          collectionDate: new Date('2030-01-01T00:00:00.000Z'),
        })),
      },
      collectionItem: { aggregate: vi.fn() },
      cashAccount: { findFirst: vi.fn(async () => cashAccountDbRow()), updateMany: vi.fn(async () => ({ count: 1 })) },
      transactionCategory: { findFirst: vi.fn(async () => categoryDbRow({ type: TransactionType.INCOME, id: 'category-income', key: 'jimpitan' })) },
      cashLedger: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ledgerDbRow({ amount: new Prisma.Decimal('75000'), balanceAfter: new Prisma.Decimal('175000') })) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    const result = await repository.postValidatedCollection('rt-1', { collectionId: 'collection-1' }, actor, { correlationId: 'corr-bulk-post' });

    expect(tx.collectionItem.aggregate).not.toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: new Prisma.Decimal('75000') }) }));
    expect(result.collectionMode).toBe(CollectionMode.BULK_TOTAL);
    expect(result.collectionTotalAmount).toBe('75000');
  });

  it('blocks per-house collection posting when paid item totals diverge from the validated total', async () => {
    const tx = {
      transaction: { findFirst: vi.fn(async () => null), create: vi.fn() },
      jimpitanCollection: {
        findFirst: vi.fn(async () => ({
          id: 'collection-1',
          rtId: 'rt-1',
          collectionMode: CollectionMode.PER_HOUSE,
          status: CollectionStatus.VALIDATED,
          totalAmount: new Prisma.Decimal('75000'),
          collectionDate: new Date('2030-01-01T00:00:00.000Z'),
        })),
      },
      collectionItem: { aggregate: vi.fn(async () => ({ _sum: { amount: new Prisma.Decimal('70000') } })) },
    };
    const prisma = {
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    await expect(repository.postValidatedCollection('rt-1', { collectionId: 'collection-1' }, actor, { correlationId: 'corr-per-house-post' })).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.collectionItem.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ collectionId: 'collection-1' }) }));
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('blocks posting validated expenses while required approvals are still pending', async () => {
    const validatedExpense = transactionDbRow({ type: TransactionType.EXPENSE, status: 'VALIDATED' as TransactionStatus, amount: new Prisma.Decimal('100000') });
    const tx = {
      transaction: { findFirst: vi.fn().mockResolvedValueOnce(validatedExpense).mockResolvedValueOnce(null) },
      cashAccount: { findFirst: vi.fn(async () => cashAccountDbRow()), updateMany: vi.fn(async () => ({ count: 1 })) },
      transactionCategory: { findFirst: vi.fn(async () => categoryDbRow({ type: TransactionType.EXPENSE })) },
      expenseApproval: { findMany: vi.fn(async () => [expenseApprovalDbRow()]) },
      setting: { findUnique: vi.fn(async () => policySetting()) },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      transaction: { findFirst: vi.fn(async () => null) },
      auditLog: { create: vi.fn(async () => ({})) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const repository = new PrismaFinanceRepository(prisma as never);

    await expect(repository.postTransaction('rt-1', 'transaction-1', { idempotencyKey: 'post-expense-1' }, actor, { correlationId: 'corr-4' })).rejects.toThrow(
      'Expense transaction requires completed approval before posting.',
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'TRANSACTION_POST_BLOCKED_APPROVAL_REQUIRED' }) }));
  });
});

function knownPrismaError(code: string, target: string[]) {
  return new PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: 'test',
    meta: { target },
  });
}

function ledgerDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ledger-1',
    rtId: 'rt-1',
    cashAccountId: 'account-1',
    transactionId: 'transaction-1',
    ledgerSequence: 1,
    entryType: LedgerEntryType.INCREASE,
    amount: new Prisma.Decimal('10000'),
    balanceBefore: new Prisma.Decimal('0'),
    balanceAfter: new Prisma.Decimal('10000'),
    ledgerDate: new Date('2030-01-02T00:00:00.000Z'),
    createdAt: new Date('2030-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

function transactionDbRow(overrides: Record<string, unknown> = {}) {
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
    amount: new Prisma.Decimal('10000'),
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

function cashAccountDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    rtId: 'rt-1',
    key: 'main',
    name: 'Kas Utama',
    currency: 'IDR',
    currentBalance: new Prisma.Decimal('100000'),
    version: 1,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function categoryDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'category-expense',
    rtId: 'rt-1',
    type: TransactionType.EXPENSE,
    key: 'operational',
    name: 'Operational',
    isSystem: false,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function expenseApprovalDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval-1',
    status: 'PENDING',
    ...overrides,
  };
}

function policySetting() {
  return {
    value: {
      thresholdAmount: '50000',
      autoApproveBelowThreshold: true,
      preventSelfApproval: true,
      approverRoleKeys: ['KETUA_RT'],
      requiredApprovals: 1,
      expiresInDays: 7,
    },
  };
}
