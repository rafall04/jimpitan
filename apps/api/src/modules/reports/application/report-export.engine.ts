/**
 * Purpose: Pure table builder for report export generation.
 * Caller: ReportsService CSV lifecycle and report export worker tests.
 * Deps: Report export table ports and report domain DTOs.
 * MainFuncs: Builds private finance/collection/ledger/transaction tables and public-safe transparency tables.
 * SideEffects: None.
 */
import type { ReportExportTable } from './report-export.ports';
import type {
  CollectionPerformanceReport,
  FinanceSummaryReport,
  LedgerExportRow,
  PublicMonthlyFinanceReport,
  PublicTransparencySummary,
  TransactionExportRow,
} from '../domain/reports.types';

export class ReportExportEngine {
  buildMonthlyFinanceTable(report: FinanceSummaryReport): ReportExportTable {
    return {
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Periode mulai', report.range.dateFrom],
        ['Periode selesai', report.range.dateTo],
        ['Pemasukan', report.totals.income],
        ['Pengeluaran', report.totals.expense],
        ['Arus kas bersih', report.totals.netCashFlow],
        ['Jumlah transaksi', report.totals.transactionCount],
        ...report.categoryBreakdown.map((item) => [item.categoryName, item.net]),
      ],
    };
  }

  buildCollectionSummaryTable(report: CollectionPerformanceReport): ReportExportTable {
    return {
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Periode mulai', report.range.dateFrom],
        ['Periode selesai', report.range.dateTo],
        ['Total koleksi', report.totalCollections],
        ['Koleksi tervalidasi', report.validatedCollections],
        ['Koleksi tersubmit', report.submittedCollections],
        ['Total terkumpul', report.totalCollected],
        ['Item lunas', report.paidItems],
        ['Item belum lunas', report.unpaidItems],
        ['Tingkat penyelesaian', report.completionRate],
      ],
    };
  }

  buildLedgerTable(rows: LedgerExportRow[]): ReportExportTable {
    return {
      headers: ['Tanggal', 'Urutan', 'Jenis', 'Nilai', 'Saldo Sebelum', 'Saldo Setelah', 'Akun Kas', 'Transaksi'],
      rows: rows.map((row) => [this.dateOnly(row.ledgerDate), row.ledgerSequence, row.entryType, row.amount, row.balanceBefore, row.balanceAfter, row.cashAccountName, row.transactionId]),
    };
  }

  buildTransactionTable(rows: TransactionExportRow[]): ReportExportTable {
    return {
      headers: ['Tanggal', 'Jenis', 'Status', 'Nilai', 'Kategori', 'Akun Kas', 'Deskripsi', 'Referensi'],
      rows: rows.map((row) => [this.dateOnly(row.transactionDate), row.type, row.status, row.amount, row.categoryName, row.cashAccountName, row.description, row.referenceNumber]),
    };
  }

  buildPublicSummaryTable(summary: PublicTransparencySummary): ReportExportTable {
    return {
      headers: ['Metrik', 'Nilai'],
      rows: [
        ['Organisasi', summary.rt.name],
        ['Kode RT', summary.rt.code],
        ['Bulan berjalan', summary.currentMonth],
        ['Saldo kas', summary.cashBalance.totalBalance],
        ['Pemasukan bulan ini', summary.totals.income],
        ['Pengeluaran bulan ini', summary.totals.expense],
        ['Arus kas bersih', summary.totals.netCashFlow],
        ['Jumlah akun kas', summary.cashBalance.accountCount],
        ['Terakhir diperbarui', summary.lastUpdatedAt.toISOString()],
      ],
    };
  }

  buildPublicMonthlyFinanceTable(report: PublicMonthlyFinanceReport): ReportExportTable {
    return {
      headers: ['Kategori', 'Jenis', 'Arah', 'Total'],
      rows: [
        ['Total pemasukan', 'Pemasukan', 'INCREASE', report.totals.income],
        ['Total pengeluaran', 'Pengeluaran', 'DECREASE', report.totals.expense],
        ['Arus kas bersih', 'Ringkasan', 'NET', report.totals.netCashFlow],
        ...report.categorySummaries.map((item) => [item.categoryName, item.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran', item.direction, item.total]),
      ],
    };
  }

  buildPublicCollectionTable(report: PublicMonthlyFinanceReport): ReportExportTable {
    const collectionRows = report.categorySummaries.filter((item) => item.type === 'INCOME' && /jimpitan|iuran|koleksi|infaq|infak|sedekah/i.test(`${item.categoryKey} ${item.categoryName}`));
    return {
      headers: ['Kategori', 'Jenis', 'Arah', 'Total'],
      rows: collectionRows.map((item) => [item.categoryName, 'Pemasukan', item.direction, item.total]),
    };
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
