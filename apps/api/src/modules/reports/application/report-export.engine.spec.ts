/**
 * Purpose: Unit tests for report export CSV table generation and public-safe field boundaries.
 * Caller: Vitest test runner.
 * Deps: ReportExportEngine, CsvReportSerializer, and report domain fixtures.
 * MainFuncs: Verifies CSV correctness, spreadsheet injection protection, and public export field separation.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { CsvReportSerializer } from './report-export.ports';
import { ReportExportEngine } from './report-export.engine';

describe('ReportExportEngine', () => {
  const engine = new ReportExportEngine();
  const csv = new CsvReportSerializer();

  it('builds monthly finance CSV rows with formula-safe category values', () => {
    const table = engine.buildMonthlyFinanceTable(financeSummary());
    const rendered = csv.serialize(table);

    expect(rendered).toContain('Metrik,Nilai');
    expect(rendered).toContain('Pemasukan,150000');
    expect(rendered).toContain("'=SUM(A1:A2)");
  });

  it('keeps public monthly exports aggregate-only', () => {
    const table = engine.buildPublicMonthlyFinanceTable(publicMonthlyFinance());
    const rendered = csv.serialize(table);

    expect(rendered).toContain('Kategori,Jenis,Arah,Total');
    expect(rendered).toContain('Jimpitan,Pemasukan,INCREASE,150000');
    expect(rendered).not.toMatch(/cashAccountId|ledgerSequence|resident|phone|audit|approval|internal|note/i);
  });

  it('builds private ledger CSV rows without approval internals or resident fields', () => {
    const table = engine.buildLedgerTable([
      {
        ledgerDate: new Date('2030-01-02T00:00:00.000Z'),
        ledgerSequence: 3,
        entryType: 'INCREASE',
        amount: '150000',
        balanceBefore: '0',
        balanceAfter: '150000',
        cashAccountName: 'Kas Utama',
        transactionId: 'transaction-1',
      },
    ]);
    const rendered = csv.serialize(table);

    expect(rendered).toContain('Tanggal,Urutan,Jenis,Nilai,Saldo Sebelum,Saldo Setelah,Akun Kas,Transaksi');
    expect(rendered).not.toMatch(/resident|phone|approval|internal|audit/i);
  });
});

function financeSummary() {
  return {
    reportType: 'MONTHLY_FINANCE_SUMMARY',
    period: 'MONTHLY',
    range: { dateFrom: '2030-01-01', dateTo: '2030-01-31' },
    totals: { income: '150000', expense: '50000', netCashFlow: '100000', ledgerEntryCount: 2, transactionCount: 2 },
    cashBalances: [{ cashAccountId: 'account-1', key: 'main', name: 'Kas Utama', currency: 'IDR', balance: '100000', ledgerSequence: 2 }],
    categoryBreakdown: [{ categoryId: 'category-1', categoryKey: 'formula', categoryName: '=SUM(A1:A2)', type: 'INCOME' as const, income: '150000', expense: '0', net: '150000', transactionCount: 1 }],
    source: { type: 'LEDGER' as const, postedOnly: true as const },
    snapshot: { generatedAt: new Date('2030-01-31T00:00:00.000Z'), version: 1, source: 'LEDGER' as const, cacheStrategy: 'LIVE_LEDGER_QUERY' as const },
    generatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}

function publicMonthlyFinance() {
  return {
    month: '2030-01',
    totals: { income: '150000', expense: '50000', netCashFlow: '100000' },
    categorySummaries: [{ categoryKey: 'jimpitan', categoryName: 'Jimpitan', type: 'INCOME' as const, total: '150000', direction: 'INCREASE' as const }],
    generatedAt: new Date('2030-01-31T00:00:00.000Z'),
  };
}
