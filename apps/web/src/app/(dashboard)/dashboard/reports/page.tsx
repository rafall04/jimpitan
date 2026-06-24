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
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Laporan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Ekspor laporan</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Buat CSV RT aktif, pantau status, unduh hasil, atau ulangi ekspor yang gagal.</p>
      </header>
      <ReportExportPanel title="Mesin ekspor" includeLedger includeTransactions includePublicSafe />
    </main>
  );
}
