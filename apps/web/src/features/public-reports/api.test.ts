/**
 * Purpose: Unit tests for unauthenticated public transparency API integration.
 * Caller: Vitest test runner.
 * Deps: Public report API helpers, mocked fetch, and ApiError.
 * MainFuncs: Verifies public endpoint URLs, no auth headers, safe error wrapping, and private-field rejection.
 * SideEffects: Temporarily replaces fetch implementations in individual tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertPublicPayloadSafety, getPublicMonthlyFinance, getPublicSummary, listPublicAnnouncements, listPublicReportMetadata, publicCollectionsCsvHref, publicMonthlyFinanceCsvHref, publicSummaryCsvHref } from './api';

const summaryPayload = {
  rt: { code: 'RT001', name: 'RT Sejahtera' },
  cashBalance: { totalBalance: '1500000', currency: 'IDR', accountCount: 2 },
  totals: { income: '500000', expense: '125000', netCashFlow: '375000' },
  currentMonth: '2026-05',
  lastUpdatedAt: '2026-05-26T10:00:00.000Z',
};

describe('public reports api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the public summary from backend public endpoints without auth headers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(summaryPayload), { status: 200 }));

    await getPublicSummary('RT001', { baseUrl: 'https://api.example.test/api/v1', fetcher });

    const [url, init] = fetcher.mock.calls[0];
    const headers = init.headers as Headers;
    expect(String(url)).toBe('https://api.example.test/api/v1/reports/public/RT001/summary');
    expect(init.credentials).toBe('omit');
    expect(headers.get('Authorization')).toBeNull();
    expect(headers.get('X-Tenant-Id')).toBeNull();
  });

  it('redacts phone-like strings from public API payload copy before rendering', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ id: 'announcement-1', title: 'Hubungi 081234567890', body: 'Info WA 081234567890', publishedAt: '2026-05-26T08:00:00.000Z' }],
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
        }),
        { status: 200 },
      ),
    );

    const result = await listPublicAnnouncements('RT001', { limit: 1 }, { baseUrl: 'https://api.example.test/api/v1', fetcher });

    expect(result.items[0].title).not.toContain('081234567890');
    expect(result.items[0].body).not.toContain('081234567890');
  });

  it('loads month-filtered public finance reports with a shareable month query', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          month: '2026-04',
          totals: { income: '200000', expense: '50000', netCashFlow: '150000' },
          categorySummaries: [],
          generatedAt: '2026-05-01T00:00:00.000Z',
        }),
        { status: 200 },
      ),
    );

    await getPublicMonthlyFinance('RT001', '2026-04', { baseUrl: 'https://api.example.test/api/v1', fetcher });

    expect(String(fetcher.mock.calls[0][0])).toBe('https://api.example.test/api/v1/reports/public/RT001/monthly-finance?month=2026-04');
  });

  it('loads public report and announcement feeds from public-safe endpoints', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, limit: 3, total: 0, totalPages: 0 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 1, limit: 5, total: 0, totalPages: 0 }), { status: 200 }));

    await listPublicReportMetadata('RT001', { limit: 3 }, { baseUrl: 'https://api.example.test/api/v1', fetcher });
    await listPublicAnnouncements('RT001', { limit: 5, search: 'iuran' }, { baseUrl: 'https://api.example.test/api/v1', fetcher });

    expect(String(fetcher.mock.calls[0][0])).toBe('https://api.example.test/api/v1/reports/public/RT001/metadata?limit=3');
    expect(String(fetcher.mock.calls[1][0])).toBe('https://api.example.test/api/v1/reports/public/RT001/announcements?limit=5&search=iuran');
  });

  it('builds public CSV export links against public endpoints only', () => {
    expect(publicSummaryCsvHref('RT001', { baseUrl: 'https://api.example.test/api/v1' })).toBe('https://api.example.test/api/v1/reports/public/RT001/exports/summary.csv');
    expect(publicMonthlyFinanceCsvHref('RT001', '2026-04', { baseUrl: 'https://api.example.test/api/v1' })).toBe('https://api.example.test/api/v1/reports/public/RT001/exports/monthly-finance.csv?month=2026-04');
    expect(publicCollectionsCsvHref('RT001', '2026-04', { baseUrl: 'https://api.example.test/api/v1' })).toBe('https://api.example.test/api/v1/reports/public/RT001/exports/collections.csv?month=2026-04');
  });

  it('wraps public API failures in a non-sensitive error message', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'database failed with private trace' }), { status: 503 }));

    await expect(getPublicSummary('RT001', { baseUrl: 'https://api.example.test/api/v1', fetcher })).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
      message: 'Laporan publik belum dapat dimuat.',
    });
  });

  it('rejects private fields before public payloads can be rendered', () => {
    expect(() => assertPublicPayloadSafety({ rt: { name: 'RT' }, residentPhone: '081234567890' })).toThrow('private field');
    expect(() => assertPublicPayloadSafety({ approvals: [{ id: 'approval-1' }] })).toThrow('private field');
  });
});
