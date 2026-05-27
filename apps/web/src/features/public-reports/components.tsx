/**
 * Purpose: Server-renderable public transparency UI components.
 * Caller: Public App Router pages and render smoke tests.
 * Deps: next/link, lucide-react icons, UI primitives, public report formatting, and public report types.
 * MainFuncs: Renders home, reports, monthly, collections, announcements, loading, tables, charts, and empty states.
 * SideEffects: None.
 */
import { ArrowRight, CalendarDays, Download, FileText, Megaphone, WalletCards } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIdr, formatIndonesianDate, formatIndonesianMonth, publicReportHref, sanitizePublicCopy } from './format';
import type { PublicAnnouncement, PublicCategorySummary, PublicMonthlyFinanceReport, PublicPaginatedResult, PublicReportMetadata, PublicTransparencySummary } from './types';

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export type PublicExportLinks = {
  summary?: string;
  monthly?: string;
  collections?: string;
};

export function PublicHomeView({ summary, latestReport, announcements, rtCode }: { summary: PublicTransparencySummary; latestReport?: PublicReportMetadata; announcements: PublicAnnouncement[]; rtCode: string }) {
  return (
    <main id="main-content" className="w-full">
      <section className="border-b bg-secondary/40">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_0.8fr] md:py-14 lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase text-primary">Transparansi warga</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">{sanitizePublicCopy(summary.rt.name)}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Ringkasan kas dan laporan publik yang dapat dibaca warga tanpa login. Data ditampilkan sebagai agregat aman, tanpa data pribadi warga.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={publicReportHref('/reports', rtCode)}>
                  Lihat laporan <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={publicReportHref('/announcements', rtCode)}>
                  Pengumuman <Megaphone className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
          <MetricStack summary={summary} compact />
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:px-6 md:grid-cols-2 lg:px-8">
        <InfoPanel title="Laporan terbaru" icon={<FileText className="h-5 w-5" aria-hidden="true" />}>
          {latestReport ? (
            <Link href={publicReportHref('/announcements', rtCode)} className="block rounded-md border p-4 transition-colors hover:bg-secondary">
              <span className="block text-sm text-muted-foreground">{formatIndonesianDate(latestReport.publishedAt)}</span>
              <span className="mt-1 block font-medium">{sanitizePublicCopy(latestReport.title)}</span>
            </Link>
          ) : (
            <EmptyInline title="Belum ada laporan publik" description="Laporan akan muncul setelah dipublikasikan pengurus." />
          )}
        </InfoPanel>
        <InfoPanel title="Pengumuman terbaru" icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}>
          <AnnouncementList announcements={announcements.slice(0, 3)} />
        </InfoPanel>
      </section>
    </main>
  );
}

export function PublicReportsView({ summary, monthly, trend, latestReports, rtCode, exportLinks = {} }: { summary: PublicTransparencySummary; monthly: PublicMonthlyFinanceReport; trend: PublicMonthlyFinanceReport[]; latestReports: PublicReportMetadata[]; rtCode: string; exportLinks?: PublicExportLinks }) {
  return (
    <PublicPageShell eyebrow="Laporan publik" title="Ringkasan Keuangan Publik" description={`Periode berjalan: ${formatIndonesianMonth(summary.currentMonth)}. Angka berasal dari transaksi yang sudah diposting.`}>
      <MetricStack summary={summary} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <InfoPanel title="Tren 6 bulan" icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}>
          <TrendTable reports={trend} />
        </InfoPanel>
        <InfoPanel title="Feed laporan" icon={<FileText className="h-5 w-5" aria-hidden="true" />}>
          {latestReports.length > 0 ? (
            <ul className="space-y-3">
              {latestReports.map((item) => (
                <li key={item.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <span className="block text-xs text-muted-foreground">{formatIndonesianDate(item.publishedAt)}</span>
                  <span className="block text-sm font-medium">{sanitizePublicCopy(item.title)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyInline title="Belum ada feed laporan" description="Metadata laporan publik belum tersedia." />
          )}
        </InfoPanel>
      </div>
      <CategoryTable categories={monthly.categorySummaries} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href={publicReportHref('/reports/monthly', rtCode, { month: monthly.month })}>
            Laporan bulanan <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={publicReportHref('/reports/collections', rtCode, { month: monthly.month })}>
            Ringkasan koleksi <WalletCards className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        {exportLinks.summary ? <CsvExportButton href={exportLinks.summary} label="Unduh ringkasan CSV" /> : null}
      </div>
    </PublicPageShell>
  );
}

export function PublicMonthlyReportView({ summary, report, rtCode, exportLinks = {} }: { summary: PublicTransparencySummary; report: PublicMonthlyFinanceReport; rtCode: string; exportLinks?: PublicExportLinks }) {
  return (
    <PublicPageShell eyebrow="Laporan bulanan" title={`Laporan ${formatIndonesianMonth(report.month)}`} description={`Organisasi: ${sanitizePublicCopy(summary.rt.name)}. Tautan halaman ini dapat dibagikan ke warga.`}>
      <MonthFilter action="/reports/monthly" rtCode={rtCode} month={report.month} />
      <MetricGrid items={[['Pemasukan', report.totals.income], ['Pengeluaran', report.totals.expense], ['Arus kas bersih', report.totals.netCashFlow]]} />
      <p className="text-sm text-muted-foreground">Terakhir dihitung: {formatIndonesianDate(report.generatedAt)}. Saldo kas saat ini: {formatIdr(summary.cashBalance.totalBalance)}.</p>
      <CategoryTable categories={report.categorySummaries} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <Link href={publicReportHref('/reports/monthly', rtCode, { month: report.month })}>Tautan laporan bulanan</Link>
        </Button>
        {exportLinks.monthly ? <CsvExportButton href={exportLinks.monthly} label="Unduh laporan CSV" /> : null}
      </div>
    </PublicPageShell>
  );
}

export function PublicCollectionsView({ summary, report, rtCode, exportLinks = {} }: { summary: PublicTransparencySummary; report: PublicMonthlyFinanceReport; rtCode: string; exportLinks?: PublicExportLinks }) {
  const collectionCategories = collectionLikeCategories(report.categorySummaries);
  return (
    <PublicPageShell eyebrow="Koleksi warga" title="Ringkasan Koleksi" description={`Agregat pemasukan koleksi untuk ${formatIndonesianMonth(report.month)} di ${sanitizePublicCopy(summary.rt.name)}.`}>
      <MonthFilter action="/reports/collections" rtCode={rtCode} month={report.month} />
      <MetricGrid items={[['Total koleksi terpublikasi', sumCategories(collectionCategories)], ['Total pemasukan bulan ini', report.totals.income], ['Saldo kas publik', summary.cashBalance.totalBalance]]} />
      {collectionCategories.length > 0 ? <CategoryTable categories={collectionCategories} caption="Kategori pemasukan koleksi publik" /> : <EmptyInline title="Belum ada kategori koleksi" description="Data koleksi belum muncul sebagai kategori pemasukan publik pada bulan ini." />}
      <InfoPanel title="Ringkasan tunggakan" icon={<WalletCards className="h-5 w-5" aria-hidden="true" />}>
        <EmptyInline title="Ringkasan tunggakan belum dipublikasikan" description="Endpoint publik saat ini tidak menyediakan ringkasan tunggakan agregat yang aman untuk ditampilkan." />
      </InfoPanel>
      {exportLinks.collections ? <CsvExportButton href={exportLinks.collections} label="Unduh koleksi CSV" /> : null}
    </PublicPageShell>
  );
}

export function PublicAnnouncementsView({ summary, announcements, pagination, rtCode, search }: { summary: PublicTransparencySummary; announcements: PublicAnnouncement[]; pagination: Omit<PublicPaginatedResult<PublicAnnouncement>, 'items'>; rtCode: string; search: string }) {
  return (
    <PublicPageShell eyebrow="Pengumuman" title="Pengumuman Publik" description={`Pengumuman terpublikasi untuk ${sanitizePublicCopy(summary.rt.name)}.`}>
      <form action="/announcements" className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row">
        <input type="hidden" name="rt" value={rtCode} />
        <input name="search" defaultValue={search} placeholder="Cari pengumuman" className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" />
        <Button type="submit">Cari</Button>
      </form>
      {announcements.length > 0 ? <AnnouncementList announcements={announcements} /> : <EmptyState title="Belum ada pengumuman publik" description="Pengumuman publik akan muncul setelah dipublikasikan pengurus." />}
      {pagination.totalPages > 1 ? (
        <nav aria-label="Halaman pengumuman" className="flex items-center justify-between text-sm">
          <Link href={publicReportHref('/announcements', rtCode, { search, page: Math.max(1, pagination.page - 1) })}>Sebelumnya</Link>
          <span>
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <Link href={publicReportHref('/announcements', rtCode, { search, page: Math.min(pagination.totalPages, pagination.page + 1) })}>Berikutnya</Link>
        </nav>
      ) : null}
    </PublicPageShell>
  );
}

export function PublicRouteLoadingSkeleton({ label }: { label: string }) {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </main>
  );
}

export function PublicTenantRequiredView() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-16 sm:px-6 lg:px-8">
      <EmptyState title="Kode RT publik belum dikonfigurasi" description="Gunakan tautan publik resmi dari pengurus atau atur kode RT publik pada konfigurasi aplikasi." />
    </main>
  );
}

function PublicPageShell({ eyebrow, title, description, children }: PageShellProps) {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase text-primary">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{description}</p>
      </header>
      {children}
    </main>
  );
}

function MetricStack({ summary, compact = false }: { summary: PublicTransparencySummary; compact?: boolean }) {
  return <MetricGrid compact={compact} items={[['Saldo kas saat ini', summary.cashBalance.totalBalance], ['Pemasukan bulan ini', summary.totals.income], ['Pengeluaran bulan ini', summary.totals.expense]]} />;
}

function MetricGrid({ items, compact = false }: { items: Array<[string, string]>; compact?: boolean }) {
  return (
    <dl className={compact ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 md:grid-cols-3'}>
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-background p-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="mt-2 text-2xl font-semibold">{formatIdr(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function InfoPanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border bg-background p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CsvExportButton({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="outline" asChild>
      <a href={href} download>
        {label} <Download className="h-4 w-4" aria-hidden="true" />
      </a>
    </Button>
  );
}

function EmptyInline({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function TrendTable({ reports }: { reports: PublicMonthlyFinanceReport[] }) {
  const maxValue = Math.max(1, ...reports.flatMap((report) => [Number(report.totals.income), Number(report.totals.expense)]));
  return (
    <div>
      <div role="img" aria-label="Tren 6 bulan pemasukan dan pengeluaran" className="space-y-3">
        {reports.map((report) => (
          <div key={report.month} className="grid grid-cols-[5rem_1fr] items-center gap-3">
            <span className="text-sm text-muted-foreground">{formatIndonesianMonth(report.month)}</span>
            <div className="space-y-1">
              <div className="h-3 rounded-sm bg-primary" style={{ width: `${Math.max(2, (Number(report.totals.income) / maxValue) * 100)}%` }} />
              <div className="h-3 rounded-sm bg-accent" style={{ width: `${Math.max(2, (Number(report.totals.expense) / maxValue) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <table className="mt-5 w-full text-left text-sm">
        <caption className="sr-only">Tabel tren pemasukan dan pengeluaran 6 bulan</caption>
        <thead className="text-muted-foreground">
          <tr>
            <th scope="col" className="py-2">Bulan</th>
            <th scope="col" className="py-2">Pemasukan</th>
            <th scope="col" className="py-2">Pengeluaran</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.month} className="border-t">
              <td className="py-2">{formatIndonesianMonth(report.month)}</td>
              <td className="py-2">{formatIdr(report.totals.income)}</td>
              <td className="py-2">{formatIdr(report.totals.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryTable({ categories, caption = 'Rincian kategori pemasukan dan pengeluaran publik' }: { categories: PublicCategorySummary[]; caption?: string }) {
  if (categories.length === 0) {
    return <EmptyState title="Belum ada rincian kategori" description="Kategori pemasukan atau pengeluaran belum tersedia untuk periode ini." />;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-secondary text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">Kategori</th>
            <th scope="col" className="px-4 py-3">Jenis</th>
            <th scope="col" className="px-4 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={`${category.categoryKey}-${category.direction}`} className="border-t">
              <td className="px-4 py-3 font-medium">{sanitizePublicCopy(category.categoryName)}</td>
              <td className="px-4 py-3">{category.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}</td>
              <td className="px-4 py-3 text-right">{formatIdr(category.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: PublicAnnouncement[] }) {
  if (announcements.length === 0) {
    return <EmptyInline title="Belum ada pengumuman publik" description="Tidak ada pengumuman publik pada daftar ini." />;
  }
  return (
    <ul className="space-y-4">
      {announcements.map((item) => (
        <li key={item.id} className="rounded-md border p-4">
          <time className="text-xs text-muted-foreground" dateTime={item.publishedAt}>{formatIndonesianDate(item.publishedAt)}</time>
          <h2 className="mt-1 text-base font-semibold">{sanitizePublicCopy(item.title)}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{sanitizePublicCopy(item.body)}</p>
        </li>
      ))}
    </ul>
  );
}

function MonthFilter({ action, rtCode, month }: { action: string; rtCode: string; month: string }) {
  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row">
      <input type="hidden" name="rt" value={rtCode} />
      <label className="flex flex-1 flex-col gap-2 text-sm font-medium">
        Bulan laporan
        <input type="month" name="month" defaultValue={month} className="h-10 rounded-md border bg-background px-3 text-sm" />
      </label>
      <Button type="submit" className="sm:self-end">Terapkan</Button>
    </form>
  );
}

function collectionLikeCategories(categories: PublicCategorySummary[]): PublicCategorySummary[] {
  const candidates = categories.filter((category) => category.type === 'INCOME');
  return candidates.filter((category) => /jimpitan|iuran|koleksi|infaq|infak|sedekah/i.test(`${category.categoryKey} ${category.categoryName}`));
}

function sumCategories(categories: PublicCategorySummary[]): string {
  return categories.reduce((sum, category) => sum + Number(category.total), 0).toString();
}
