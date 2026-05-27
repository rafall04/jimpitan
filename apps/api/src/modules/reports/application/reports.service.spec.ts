/**
 * Purpose: Unit tests for tenant-scoped reporting service validation and public-safe serialization.
 * Caller: Vitest test runner.
 * Deps: ReportsService, mocked report repository port, AuthPrincipal.
 * MainFuncs: Verifies date-range validation, tenant delegation, public safety, and export validation.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportExportFormat } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { ReportExportRecord } from '../domain/reports.types';
import { ReportsService } from './reports.service';

function createHarness() {
  const repository = {
    getFinanceSummary: vi.fn(async () => financeSummary()),
    getCollectionPerformance: vi.fn(async () => collectionPerformance()),
    getOutstandingHouses: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    getPerAreaProgress: vi.fn(async () => []),
    getExpenseCategoryBreakdown: vi.fn(async () => []),
    getCashFlowSummary: vi.fn(async () => cashFlowSummary()),
    getApprovalActivity: vi.fn(async () => approvalActivity()),
    getAuditActivity: vi.fn(async () => auditActivity()),
    createExportRequest: vi.fn(async () => exportRecord()),
    markExportProcessing: vi.fn(async () => ({ ...exportRecord(), status: 'PROCESSING' })),
    completeExportRequest: vi.fn(async (_rtId: string, _exportId: string, metadata: Record<string, unknown>) => ({ ...exportRecord(), status: 'COMPLETED', ...metadata })),
    failExportRequest: vi.fn(async (_rtId: string, _exportId: string, errorMessage: string) => ({ ...exportRecord(), status: 'FAILED', errorMessage })),
    retryExportRequest: vi.fn(async () => ({ ...exportRecord(), status: 'PENDING', errorMessage: null })),
    auditExportDownload: vi.fn(async () => undefined),
    expireExports: vi.fn(async () => 0),
    getLedgerExportRows: vi.fn(async () => ledgerExportRows()),
    getTransactionExportRows: vi.fn(async () => transactionExportRows()),
    listExportRequests: vi.fn(async () => ({ items: [exportRecord()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    findExportRequestById: vi.fn(async () => exportRecord()),
    getPublicSummaryByRtCode: vi.fn(async () => publicSummary()),
    getPublicMonthlyFinanceByRtCode: vi.fn(async () => publicMonthlyFinance()),
    listPublicReportMetadataByRtCode: vi.fn(async () => ({ items: [publicMetadata()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    listPublicAnnouncementsByRtCode: vi.fn(async () => ({ items: [publicAnnouncement()], page: 1, limit: 20, total: 1, totalPages: 1 })),
    recoverStaleCsvExports: vi.fn(async () => 0),
    claimPendingCsvExports: vi.fn(async (): Promise<ReportExportRecord[]> => []),
  };
  const principal: AuthPrincipal = { userId: 'user-1', membershipId: 'membership-1', rtId: 'rt-1', roles: ['BENDAHARA'], permissions: ['reports.private.read'] };
  const service = new (ReportsService as any)(repository);
  return { principal, repository, service };
}

describe('ReportsService', () => {
  it('rejects inverted report date ranges before hitting persistence', async () => {
    const { principal, repository, service } = createHarness();

    await expect(service.getFinanceSummary(principal, { dateFrom: '2030-02-01', dateTo: '2030-01-01' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.getFinanceSummary).not.toHaveBeenCalled();
  });

  it('rejects impossible calendar dates before hitting persistence', async () => {
    const { principal, repository, service } = createHarness();

    await expect(service.getFinanceSummary(principal, { dateFrom: '2030-02-30', dateTo: '2030-03-10' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.getFinanceSummary).not.toHaveBeenCalled();
  });

  it('rejects invalid public month values before repository access', async () => {
    const { repository, service } = createHarness();

    await expect(service.getPublicMonthlyFinance('RT001', { month: '2030-13' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.getPublicMonthlyFinanceByRtCode).not.toHaveBeenCalled();
  });

  it('delegates private finance summaries with the current tenant and normalized dates', async () => {
    const { principal, repository, service } = createHarness();

    await service.getFinanceSummary(principal, { period: 'MONTHLY', dateFrom: '2030-01-01', dateTo: '2030-01-31', cashAccountId: 'account-1' });

    expect(repository.getFinanceSummary).toHaveBeenCalledWith('rt-1', {
      period: 'MONTHLY',
      dateFrom: '2030-01-01',
      dateTo: '2030-01-31',
      cashAccountId: 'account-1',
    });
  });

  it('returns only public-safe transparency fields', async () => {
    const { repository, service } = createHarness();
    repository.getPublicSummaryByRtCode.mockResolvedValueOnce({
      ...publicSummary(),
      auditActivity: { total: 99 },
      internalNotes: 'private',
      residents: [{ id: 'resident-1', fullName: 'Resident Name', phone: '0812' }],
    } as never);

    const result = await service.getPublicSummary('RT001');

    expect(result).toEqual({
      rt: { code: 'RT001', name: 'RT 001' },
      cashBalance: { totalBalance: '100000', currency: 'IDR', accountCount: 1 },
      totals: { income: '150000', expense: '50000', netCashFlow: '100000' },
      currentMonth: '2030-01',
      lastUpdatedAt: new Date('2030-01-31T00:00:00.000Z'),
    });
  });

  it('validates export requests and preserves idempotency keys', async () => {
    const { principal, repository, service } = createHarness();

    await service.createExport(principal, { reportType: 'MONTHLY_FINANCE_SUMMARY', format: ReportExportFormat.CSV, idempotencyKey: 'export-1', filters: { month: '2030-01' } }, {});

    expect(repository.createExportRequest).toHaveBeenCalledWith(
      'rt-1',
      { reportType: 'MONTHLY_FINANCE_SUMMARY', format: ReportExportFormat.CSV, idempotencyKey: 'export-1', visibility: 'PRIVATE', filters: { month: '2030-01', dateFrom: '2030-01-01', dateTo: '2030-01-31', visibility: 'PRIVATE' } },
      principal,
      {},
    );
    expect(repository.markExportProcessing).toHaveBeenCalledWith('rt-1', 'export-1', principal, {});
    expect(repository.completeExportRequest).toHaveBeenCalledWith(
      'rt-1',
      'export-1',
      expect.objectContaining({ fileName: expect.stringContaining('monthly-finance-summary'), objectKey: expect.stringContaining('export-1.csv') }),
      principal,
      {},
    );
  });

  it('rejects export filters with prototype pollution keys', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createExport(principal, { reportType: 'MONTHLY_FINANCE_SUMMARY', format: ReportExportFormat.CSV, filters: { constructor: { prototype: { polluted: true } } } }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createExportRequest).not.toHaveBeenCalled();
  });

  it('returns downloadable CSV content and audits tenant-scoped downloads', async () => {
    const { principal, repository, service } = createHarness();
    repository.findExportRequestById.mockResolvedValueOnce({
      ...exportRecord(),
      status: 'COMPLETED',
      fileName: 'monthly-finance-summary-2030-01.csv',
      objectKey: 'report-exports/rt-1/export-1.csv',
    });

    const download = await service.downloadExport(principal, 'export-1', {});

    expect(download.fileName).toContain('monthly-finance-summary');
    expect(download.contentType).toBe('text/csv; charset=utf-8');
    expect(download.content).toContain('Metrik,Nilai');
    expect(download.content).toContain('Pemasukan,150000');
    expect(repository.findExportRequestById).toHaveBeenCalledWith('rt-1', 'export-1');
    expect(repository.auditExportDownload).toHaveBeenCalledWith('rt-1', expect.objectContaining({ id: 'export-1' }), principal, {});
  });

  it('does not expose private fields in public-safe export downloads', async () => {
    const { principal, repository, service } = createHarness();
    repository.findExportRequestById.mockResolvedValueOnce({
      ...exportRecord(),
      reportType: 'PUBLIC_MONTHLY_FINANCE',
      status: 'COMPLETED',
      filters: { month: '2030-01', visibility: 'PUBLIC_SAFE' },
      fileName: 'public-monthly-finance-2030-01.csv',
      objectKey: 'report-exports/rt-1/export-1.csv',
    });

    const download = await service.downloadExport(principal, 'export-1', {});

    expect(download.content).toContain('Kategori,Jenis,Arah,Total');
    expect(download.content).not.toMatch(/cashAccountId|ledgerSequence|resident|phone|audit|approval|internal|note/i);
  });

  it('rejects ledger exports when requested as public-safe', async () => {
    const { principal, repository, service } = createHarness();

    await expect(service.createExport(principal, { reportType: 'LEDGER_EXPORT', format: ReportExportFormat.CSV, visibility: 'PUBLIC_SAFE', filters: { dateFrom: '2030-01-01', dateTo: '2030-01-31' } }, {})).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createExportRequest).not.toHaveBeenCalled();
  });

  it('records failed CSV exports without leaking the thrown implementation error', async () => {
    const { principal, repository, service } = createHarness();
    repository.getFinanceSummary.mockRejectedValueOnce(new Error('database trace with private table'));

    const result = await service.createExport(principal, { reportType: 'MONTHLY_FINANCE_SUMMARY', format: ReportExportFormat.CSV, filters: { month: '2030-01' } }, {});

    expect(result.status).toBe('FAILED');
    expect(repository.failExportRequest).toHaveBeenCalledWith('rt-1', 'export-1', 'Report export generation failed.', principal, {});
  });

  it('retries failed CSV exports through the same tenant-scoped export record', async () => {
    const { principal, repository, service } = createHarness();
    repository.findExportRequestById.mockResolvedValueOnce({ ...exportRecord(), status: 'FAILED', errorMessage: 'Report export generation failed.' });

    const result = await service.retryExport(principal, 'export-1', {});

    expect(repository.findExportRequestById).toHaveBeenCalledWith('rt-1', 'export-1');
    expect(repository.retryExportRequest).toHaveBeenCalledWith('rt-1', 'export-1', principal, {});
    expect(result.status).toBe('COMPLETED');
  });

  it('processes queued CSV exports for the worker with requested-user audit context', async () => {
    const { repository, service } = createHarness();
    repository.claimPendingCsvExports.mockResolvedValueOnce([
      exportRecord({ id: 'export-worker-1', requestedById: 'user-worker-1', status: 'PENDING' }),
      exportRecord({ id: 'export-worker-2', requestedById: 'user-worker-2', status: 'PENDING' }),
    ]);

    const result = await service.processPendingCsvExports({ limit: 2, correlationId: 'worker-run-1' });

    expect(repository.claimPendingCsvExports).toHaveBeenCalledWith(2);
    expect(repository.recoverStaleCsvExports).toHaveBeenCalledWith(expect.any(Date));
    expect(repository.markExportProcessing).toHaveBeenCalledWith(
      'rt-1',
      'export-worker-1',
      expect.objectContaining({ userId: 'user-worker-1', rtId: 'rt-1' }),
      { correlationId: 'worker-run-1' },
    );
    expect(repository.completeExportRequest).toHaveBeenCalledWith(
      'rt-1',
      'export-worker-2',
      expect.objectContaining({ fileName: expect.stringContaining('monthly-finance-summary'), objectKey: expect.stringContaining('export-worker-2.csv') }),
      expect.objectContaining({ userId: 'user-worker-2', rtId: 'rt-1' }),
      { correlationId: 'worker-run-1' },
    );
    expect(result).toEqual({ processed: 2, completed: 2, failed: 0 });
  });

  it('rejects download requests outside the active tenant', async () => {
    const { principal, repository, service } = createHarness();
    repository.findExportRequestById.mockResolvedValueOnce(null as never);

    await expect(service.downloadExport(principal, 'export-elsewhere', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});

function financeSummary() {
  return {
    reportType: 'MONTHLY_FINANCE_SUMMARY',
    period: 'MONTHLY',
    range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' },
    totals: { income: '150000', expense: '50000', netCashFlow: '100000', ledgerEntryCount: 2, transactionCount: 2 },
    cashBalances: [],
    categoryBreakdown: [],
    source: { type: 'LEDGER', postedOnly: true },
    generatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}

function collectionPerformance() {
  return {
    range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' },
    totalCollections: 1,
    validatedCollections: 1,
    submittedCollections: 0,
    totalCollected: '150000',
    totalItems: 10,
    paidItems: 9,
    unpaidItems: 1,
    completionRate: 90,
    generatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}

function cashFlowSummary() {
  return {
    range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' },
    openingBalance: '0',
    income: '150000',
    expense: '50000',
    netCashFlow: '100000',
    closingBalance: '100000',
    generatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}

function approvalActivity() {
  return { range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' }, pending: 0, approved: 1, rejected: 0, cancelled: 0, generatedAt: new Date('2030-01-31T00:00:00.000Z') };
}

function auditActivity() {
  return { range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' }, totalEvents: 1, byAction: [{ action: 'TRANSACTION_POSTED', count: 1 }], generatedAt: new Date('2030-01-31T00:00:00.000Z') };
}

function exportRecord(overrides: Partial<ReportExportRecord> = {}): ReportExportRecord {
  return {
    id: 'export-1',
    rtId: 'rt-1',
    requestedById: 'user-1',
    reportType: 'MONTHLY_FINANCE_SUMMARY',
    format: ReportExportFormat.CSV,
    status: 'PENDING',
    filters: { month: '2030-01' },
    fileName: null,
    objectKey: null,
    errorMessage: null,
    idempotencyKey: 'export-1',
    expiresAt: null,
    completedAt: null,
    createdAt: new Date('2030-01-31T00:00:00.000Z'),
    updatedAt: new Date('2030-01-31T00:00:00.000Z'),
    ...overrides,
  };
}

function publicSummary() {
  return {
    rt: { code: 'RT001', name: 'RT 001' },
    cashBalance: { totalBalance: '100000', currency: 'IDR', accountCount: 1 },
    totals: { income: '150000', expense: '50000', netCashFlow: '100000' },
    currentMonth: '2030-01',
    lastUpdatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}

function publicMonthlyFinance() {
  return { month: '2030-01', totals: { income: '150000', expense: '50000', netCashFlow: '100000' }, categorySummaries: [], generatedAt: new Date('2030-01-31T00:00:00.000Z') };
}

function publicMetadata() {
  return { id: 'announcement-1', title: 'January report', publishedAt: new Date('2030-01-31T00:00:00.000Z'), type: 'ANNOUNCEMENT' };
}

function publicAnnouncement() {
  return { id: 'announcement-1', title: 'January report', body: 'Published summary', publishedAt: new Date('2030-01-31T00:00:00.000Z') };
}

function ledgerExportRows() {
  return [
    {
      ledgerDate: new Date('2030-01-02T00:00:00.000Z'),
      ledgerSequence: 1,
      entryType: 'INCREASE' as const,
      amount: '150000',
      balanceBefore: '0',
      balanceAfter: '150000',
      cashAccountName: 'Kas Utama',
      transactionId: 'transaction-1',
    },
  ];
}

function transactionExportRows() {
  return [
    {
      transactionDate: new Date('2030-01-02T00:00:00.000Z'),
      type: 'INCOME' as const,
      status: 'POSTED' as const,
      amount: '150000',
      categoryName: 'Jimpitan',
      cashAccountName: 'Kas Utama',
      description: 'Koleksi rutin',
      referenceNumber: 'TRX-1',
    },
  ];
}
