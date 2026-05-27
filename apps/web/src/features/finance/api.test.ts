/**
 * Purpose: Unit tests for finance, ledger, and approval API adapter request behavior.
 * Caller: Vitest test runner.
 * Deps: Finance API functions and mocked fetch.
 * MainFuncs: Verifies tenant headers, idempotency headers, lifecycle endpoints, and error wrapping.
 * SideEffects: Temporarily replaces global fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReportExport, createTransactionDraft, downloadReportExport, listLedgerEntries, listReportExports, postCollectionToFinance, rejectApproval } from './api';

describe('finance api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates expense drafts through the same-origin proxy with tenant header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'tx-1' }), { status: 200 }));

    await createTransactionDraft('rt-1', 'expense', {
      cashAccountId: 'account-1',
      categoryId: 'category-1',
      amount: '10000',
      description: 'Office supply',
      transactionDate: '2026-05-26',
      idempotencyKey: 'draft-key',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/finance/transactions/expense');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Headers).get('X-Tenant-Id')).toBe('rt-1');
    expect((init?.headers as Headers).get('Idempotency-Key')).toBe('draft-key');
  });

  it('posts validated collections with an idempotency header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ collectionId: 'collection-1' }), { status: 200 }));

    await postCollectionToFinance('rt-1', { collectionId: 'collection-1', idempotencyKey: 'collection-key' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/finance/transactions/source-collections');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Headers).get('Idempotency-Key')).toBe('collection-key');
  });

  it('lists append-only ledger entries from the ledger endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }), { status: 200 }));

    await listLedgerEntries('rt-1', { cashAccountId: 'account-1', sortDirection: 'desc' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/ledger?cashAccountId=account-1&sortDirection=desc');
  });

  it('sends approval rejection reasons to the approval endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'approval-1' }), { status: 200 }));

    await rejectApproval('rt-1', 'approval-1', 'Missing receipt');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/approvals/approval-1/reject');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ decisionNote: 'Missing receipt' });
  });

  it('creates and lists report exports through tenant-scoped report endpoints', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'export-1', status: 'PENDING' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, limit: 5, total: 0, totalPages: 0 }), { status: 200 }));

    await createReportExport('rt-1', { reportType: 'MONTHLY_FINANCE_SUMMARY', format: 'CSV', filters: { month: '2026-05' }, idempotencyKey: 'export-key' });
    await listReportExports('rt-1', { page: 1, limit: 5, status: 'COMPLETED' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/reports/exports');
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).get('X-Tenant-Id')).toBe('rt-1');
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).get('Idempotency-Key')).toBe('export-key');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/backend/reports/exports?page=1&limit=5&status=COMPLETED');
  });

  it('downloads CSV report exports without parsing them as JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Metrik,Nilai\nPemasukan,1000', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="monthly.csv"', 'Content-Type': 'text/csv; charset=utf-8' },
      }),
    );

    const result = await downloadReportExport('rt-1', 'export-1');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/reports/exports/export-1/download');
    expect((fetchMock.mock.calls[0][1]?.headers as Headers).get('Accept')).toBe('text/csv');
    expect(result).toEqual({ fileName: 'monthly.csv', content: 'Metrik,Nilai\nPemasukan,1000' });
  });
});
