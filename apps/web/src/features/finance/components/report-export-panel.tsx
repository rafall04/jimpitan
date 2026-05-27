/**
 * Purpose: Tenant-scoped report export lifecycle panel for private finance/report pages.
 * Caller: Finance dashboard and private reports route.
 * Deps: Finance export hooks, tenant permissions, UI primitives, lucide icons, and finance error helper.
 * MainFuncs: Creates CSV exports, shows recent export statuses, retries failures, and downloads completed files.
 * SideEffects: Calls authenticated report export APIs and triggers browser CSV downloads.
 */
'use client';

import { Download, FileDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { toUserMessage } from './error-message';
import { useReportExportMutations, useReportExportsQuery } from '../hooks';
import type { CreateReportExportPayload, ReportExportRecord, ReportType } from '../types';

type ReportExportPanelProps = {
  title?: string;
  includeLedger?: boolean;
  includeTransactions?: boolean;
  includePublicSafe?: boolean;
};

export function ReportExportPanel({ title = 'Ekspor laporan', includeLedger = false, includeTransactions = false, includePublicSafe = false }: ReportExportPanelProps) {
  const { permissions } = useTenantContext();
  const exportsQuery = useReportExportsQuery({ page: 1, limit: 5 });
  const mutations = useReportExportMutations();
  const canExport = permissions.has('reports.export');
  const month = currentMonth();

  async function createCsv(reportType: ReportType, visibility: CreateReportExportPayload['visibility'] = 'PRIVATE') {
    try {
      await mutations.createExport.mutateAsync({
        reportType,
        format: 'CSV',
        visibility,
        filters: { month, dateFrom: `${month}-01`, dateTo: endOfMonth(month), visibility },
        idempotencyKey: `${reportType}:${visibility}:${month}:csv`,
      });
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function download(record: ReportExportRecord) {
    try {
      const result = await mutations.downloadExport.mutateAsync(record.id);
      const url = URL.createObjectURL(new Blob([result.content], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function retry(record: ReportExportRecord) {
    try {
      await mutations.retryExport.mutateAsync(record.id);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  if (!canExport) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Akses ekspor membutuhkan izin laporan.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">CSV dibuat dari endpoint laporan tenant aktif dan dapat diunduh saat status selesai.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void createCsv('MONTHLY_FINANCE_SUMMARY')} disabled={mutations.createExport.isPending}>
            <FileDown className="h-4 w-4" aria-hidden="true" /> Ringkasan CSV
          </Button>
          {includeLedger ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void createCsv('LEDGER_EXPORT')} disabled={mutations.createExport.isPending}>
              <FileDown className="h-4 w-4" aria-hidden="true" /> Ledger CSV
            </Button>
          ) : null}
          {includeTransactions ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void createCsv('TRANSACTION_EXPORT')} disabled={mutations.createExport.isPending}>
              <FileDown className="h-4 w-4" aria-hidden="true" /> Transaksi CSV
            </Button>
          ) : null}
          {includePublicSafe ? (
            <Button type="button" size="sm" variant="outline" onClick={() => void createCsv('PUBLIC_MONTHLY_FINANCE', 'PUBLIC_SAFE')} disabled={mutations.createExport.isPending}>
              <FileDown className="h-4 w-4" aria-hidden="true" /> Publik CSV
            </Button>
          ) : null}
        </div>
      </div>
      {exportsQuery.isPending ? <Skeleton className="mt-4 h-28 w-full" /> : null}
      {exportsQuery.data?.items.length === 0 ? <EmptyState title="Belum ada ekspor" description="Ekspor yang dibuat akan muncul bersama statusnya." /> : null}
      <div className="mt-4 divide-y">
        {exportsQuery.data?.items.map((record) => (
          <div key={record.id} className="grid gap-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_8rem_9rem_auto] md:items-center">
            <div>
              <p className="font-medium">{exportLabel(record.reportType)}</p>
              <p className="text-xs text-muted-foreground">{record.fileName ?? 'File belum tersedia'}</p>
            </div>
            <span className="rounded-md border px-2 py-1 text-center text-xs font-medium">{statusLabel(record.status)}</span>
            <span className="text-muted-foreground">{new Date(record.createdAt).toLocaleDateString('id-ID')}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={record.status !== 'COMPLETED' || mutations.downloadExport.isPending} onClick={() => void download(record)}>
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh
              </Button>
              {record.status === 'FAILED' ? (
                <Button type="button" size="sm" variant="outline" disabled={mutations.retryExport.isPending} onClick={() => void retry(record)}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Ulangi
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function exportLabel(reportType: string): string {
  return reportType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusLabel(status: ReportExportRecord['status']): string {
  const labels: Record<ReportExportRecord['status'], string> = {
    PENDING: 'Menunggu',
    PROCESSING: 'Diproses',
    COMPLETED: 'Selesai',
    FAILED: 'Gagal',
    EXPIRED: 'Kedaluwarsa',
  };
  return labels[status];
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function endOfMonth(month: string): string {
  const [year, rawMonth] = month.split('-').map(Number);
  return new Date(Date.UTC(year, rawMonth, 0)).toISOString().slice(0, 10);
}
