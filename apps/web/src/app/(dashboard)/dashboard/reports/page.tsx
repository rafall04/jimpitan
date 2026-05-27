/**
 * Purpose: Private reports export workspace route.
 * Caller: App Router route at /dashboard/reports.
 * Deps: ReportExportPanel client component.
 * MainFuncs: Renders tenant-scoped report export lifecycle controls.
 * SideEffects: None.
 */
import { ReportExportPanel } from '@/features/finance/components/report-export-panel';

export default function ReportsPage() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <p className="text-sm font-medium text-primary">Reports</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">Ekspor laporan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Buat CSV tenant aktif, pantau status, unduh hasil, atau ulangi ekspor yang gagal.</p>
      </header>
      <ReportExportPanel title="Export engine" includeLedger includeTransactions includePublicSafe />
    </main>
  );
}
