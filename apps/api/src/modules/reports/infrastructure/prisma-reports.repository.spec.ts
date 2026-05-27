/**
 * Purpose: Unit tests for Prisma report repository ledger truth, tenant scoping, and public serializer safety.
 * Caller: Vitest test runner.
 * Deps: PrismaReportsRepository, mocked Prisma client, Prisma enums.
 * MainFuncs: Verifies report aggregates read cash ledger rows, collection modes, public queries scope by RT code, and export idempotency is safe.
 * SideEffects: None.
 */
import { CollectionItemStatus, CollectionMode, CollectionStatus, LedgerEntryType, Prisma, ReportExportFormat, ReportExportStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { PrismaReportsRepository } from './prisma-reports.repository';

const actor: AuthPrincipal = {
  userId: 'user-1',
  membershipId: 'membership-1',
  rtId: 'rt-1',
  roles: ['BENDAHARA'],
  permissions: ['reports.private.read', 'reports.export'],
};

describe('PrismaReportsRepository', () => {
  it('derives finance summaries from posted cash ledger rows instead of mutable transaction lists', async () => {
    const prisma = {
      cashLedger: {
        findMany: vi.fn(async () => [
          ledgerDbRow({ entryType: LedgerEntryType.INCREASE, amount: new Prisma.Decimal('150000') }),
          ledgerDbRow({ id: 'ledger-2', transactionId: 'transaction-2', entryType: LedgerEntryType.DECREASE, amount: new Prisma.Decimal('50000') }),
        ]),
        count: vi.fn(async () => 2),
      },
      cashAccount: { findMany: vi.fn(async () => [cashAccountDbRow()]) },
      transaction: { findMany: vi.fn(async () => []) },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.getFinanceSummary('rt-1', { period: 'MONTHLY', dateFrom: '2030-01-01', dateTo: '2030-01-31' });

    expect(result.totals).toMatchObject({ income: '150000', expense: '50000', netCashFlow: '100000', ledgerEntryCount: 2, transactionCount: 2 });
    expect(prisma.cashLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ rtId: 'rt-1', transaction: expect.objectContaining({ status: TransactionStatus.POSTED }) }) }));
    expect(prisma.cashAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: expect.objectContaining({ ledgers: expect.objectContaining({ where: expect.objectContaining({ ledgerDate: { lte: new Date('2030-01-31T23:59:59.999Z') } }) }) }) }),
    );
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('public summaries resolve an active RT code and never select resident personal fields', async () => {
    const prisma = {
      rt: { findFirst: vi.fn(async () => ({ id: 'rt-1', code: 'RT001', name: 'RT 001' })) },
      cashAccount: { findMany: vi.fn(async () => [cashAccountDbRow()]) },
      cashLedger: { findMany: vi.fn(async () => [ledgerDbRow()]) },
      resident: { findMany: vi.fn(async () => []) },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.getPublicSummaryByRtCode('RT001');

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error('Expected public summary result.');
    }
    expect(result.rt).toEqual({ code: 'RT001', name: 'RT 001' });
    expect(prisma.rt.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'RT001', isActive: true, deletedAt: null } }));
    expect(prisma.resident.findMany).not.toHaveBeenCalled();
  });

  it('creates report export requests with tenant-scoped idempotency replay', async () => {
    const existing = reportExportDbRow({ idempotencyKey: 'export-1' });
    const prisma = {
      reportExport: {
        findFirst: vi.fn(async () => existing),
        create: vi.fn(async () => reportExportDbRow()),
      },
      auditLog: { create: vi.fn(async () => ({})) },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.createExportRequest(
      'rt-1',
      { reportType: 'MONTHLY_FINANCE_SUMMARY', format: ReportExportFormat.CSV, idempotencyKey: 'export-1', filters: { month: '2030-01' } },
      actor,
      { correlationId: 'corr-1' },
    );

    expect(result.id).toBe('export-1');
    expect(prisma.reportExport.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'REPORT_EXPORT_IDEMPOTENCY_REPLAYED', rtId: 'rt-1' }) }));
  });

  it('calculates outstanding houses without exposing internal notes in the result', async () => {
    const prisma = {
      collectionItem: {
        findMany: vi.fn(async () => [
          collectionItemDbRow({ status: CollectionItemStatus.UNPAID, note: 'internal note' }),
          collectionItemDbRow({ id: 'item-2', houseId: 'house-2', status: CollectionItemStatus.MENUNGGAK, amount: new Prisma.Decimal('0') }),
        ]),
        count: vi.fn(async () => 2),
      },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.getOutstandingHouses('rt-1', { page: 1, limit: 20, dateFrom: '2030-01-01', dateTo: '2030-01-31' });

    expect(result.items[0]).not.toHaveProperty('note');
    expect(result.items[0]).toMatchObject({ houseId: 'house-1', houseNumber: 'A-01', area: { code: 'A', name: 'Area A' }, status: CollectionItemStatus.UNPAID });
    expect(prisma.collectionItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ house: expect.objectContaining({ status: expect.objectContaining({ not: 'INACTIVE' }) }) }) }));
  });

  it('excludes draft and rejected collection amounts from default performance totals', async () => {
    const prisma = {
      jimpitanCollection: {
        findMany: vi.fn(async () => [collectionDbRow({ status: CollectionStatus.VALIDATED }), collectionDbRow({ id: 'collection-2', status: CollectionStatus.REJECTED })]),
      },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.getCollectionPerformance('rt-1', { dateFrom: '2030-01-01', dateTo: '2030-01-31' });

    expect(result.totalCollections).toBe(1);
    expect(result.totalCollected).toBe('150000');
    expect(prisma.jimpitanCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: [CollectionStatus.SUBMITTED, CollectionStatus.VALIDATED] } }) }));
  });

  it('aggregates bulk total collections from collection totals without house items', async () => {
    const prisma = {
      jimpitanCollection: {
        findMany: vi.fn(async () => [
          collectionDbRow({ collectionMode: CollectionMode.PER_HOUSE, totalAmount: new Prisma.Decimal('150000'), items: [{ amount: new Prisma.Decimal('150000'), status: CollectionItemStatus.PAID }] }),
          collectionDbRow({ id: 'collection-bulk', collectionMode: CollectionMode.BULK_TOTAL, totalAmount: new Prisma.Decimal('75000'), items: [] }),
        ]),
      },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const result = await repository.getCollectionPerformance('rt-1', { dateFrom: '2030-01-01', dateTo: '2030-01-31' });

    expect(result.totalCollections).toBe(2);
    expect(result.perHouseCollections).toBe(1);
    expect(result.bulkTotalCollections).toBe(1);
    expect(result.totalCollected).toBe('225000');
    expect(result.totalItems).toBe(1);
    expect(result.completionRate).toBe(100);
  });

  it('uses grouped counts for approval and audit activity instead of loading raw rows', async () => {
    const prisma = {
      expenseApproval: {
        groupBy: vi.fn(async () => [{ status: 'APPROVED', _count: { _all: 2 } }]),
      },
      auditLog: {
        groupBy: vi.fn().mockResolvedValueOnce([{ action: 'TRANSACTION_POSTED', _count: { _all: 3 } }]).mockResolvedValueOnce([{ entityType: 'transaction', _count: { _all: 3 } }]),
        count: vi.fn(async () => 3),
      },
    };
    const repository = new PrismaReportsRepository(prisma as never);

    const approvals = await repository.getApprovalActivity('rt-1', { dateFrom: '2030-01-01', dateTo: '2030-01-31' });
    const audit = await repository.getAuditActivity('rt-1', { dateFrom: '2030-01-01', dateTo: '2030-01-31' });

    expect(approvals.approved).toBe(2);
    expect(audit.totalEvents).toBe(3);
    expect(prisma.expenseApproval.groupBy).toHaveBeenCalled();
    expect(prisma.auditLog.groupBy).toHaveBeenCalledTimes(2);
  });
});

function ledgerDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ledger-1',
    rtId: 'rt-1',
    cashAccountId: 'account-1',
    transactionId: 'transaction-1',
    ledgerSequence: 1,
    entryType: LedgerEntryType.INCREASE,
    amount: new Prisma.Decimal('150000'),
    balanceBefore: new Prisma.Decimal('0'),
    balanceAfter: new Prisma.Decimal('150000'),
    ledgerDate: new Date('2030-01-31T00:00:00.000Z'),
    createdAt: new Date('2030-01-31T00:00:00.000Z'),
    transaction: {
      id: 'transaction-1',
      type: TransactionType.INCOME,
      status: TransactionStatus.POSTED,
      categoryId: 'category-income',
      category: { id: 'category-income', key: 'jimpitan', name: 'Jimpitan', type: TransactionType.INCOME },
    },
    cashAccount: { id: 'account-1', key: 'main', name: 'Kas Utama', currency: 'IDR' },
    ...overrides,
  };
}

function cashAccountDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    key: 'main',
    name: 'Kas Utama',
    currency: 'IDR',
    currentBalance: new Prisma.Decimal('100000'),
    ledgers: [{ ledgerSequence: 2, balanceAfter: new Prisma.Decimal('100000') }],
    ...overrides,
  };
}

function reportExportDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'export-1',
    rtId: 'rt-1',
    requestedById: 'user-1',
    reportType: 'MONTHLY_FINANCE_SUMMARY',
    format: ReportExportFormat.CSV,
    status: ReportExportStatus.QUEUED,
    filters: { month: '2030-01' },
    fileName: null,
    objectKey: null,
    errorMessage: null,
    idempotencyKey: null,
    expiresAt: null,
    completedAt: null,
    createdAt: new Date('2030-01-31T00:00:00.000Z'),
    updatedAt: new Date('2030-01-31T00:00:00.000Z'),
    ...overrides,
  };
}

function collectionItemDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    houseId: 'house-1',
    amount: new Prisma.Decimal('0'),
    status: CollectionItemStatus.UNPAID,
    note: null,
    collection: { id: 'collection-1', collectionDate: new Date('2030-01-15T00:00:00.000Z'), status: CollectionStatus.VALIDATED, collectionMode: CollectionMode.PER_HOUSE },
    house: { id: 'house-1', houseNumber: 'A-01', area: { id: 'area-1', code: 'A', name: 'Area A' } },
    ...overrides,
  };
}

function collectionDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'collection-1',
    collectionMode: CollectionMode.PER_HOUSE,
    status: CollectionStatus.VALIDATED,
    totalAmount: new Prisma.Decimal('150000'),
    items: [{ amount: new Prisma.Decimal('150000'), status: CollectionItemStatus.PAID }],
    ...overrides,
  };
}
