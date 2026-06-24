/**
 * Purpose: Real dashboard home — RT health at a glance with quick actions.
 * Caller: App Router /dashboard route.
 * Deps: tenant context, finance/structure/content/approval hooks, UI Card/Button, content badges + format.
 * MainFuncs: Shows permission-gated stat cards (kas, warga, rumah, persetujuan), quick actions, and latest content.
 * SideEffects: Performs tenant-scoped API reads via TanStack Query hooks.
 */
'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, FileText, Home, Newspaper, Plus, Receipt, Users, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { useApprovalsQuery, useFinanceSummaryQuery } from '@/features/finance/hooks';
import { useHousesQuery, useResidentsQuery } from '@/features/structure/hooks';
import { useContentListQuery } from '@/features/content/hooks';
import { formatIdr } from '@/features/public-reports/format';
import { ContentStatusBadge, ContentTypeBadge } from '@/features/content/components/content-badges';
import { formatDateTime } from '@/features/content/format';
import { OnboardingChecklist } from './onboarding-checklist';

export function OverviewPage() {
  const { permissions, activeTenant, session } = useTenantContext();
  const can = (key: string) => permissions.has(key);

  const summary = useFinanceSummaryQuery();
  const residents = useResidentsQuery({ limit: 1 });
  const houses = useHousesQuery({ limit: 1 });
  const approvals = useApprovalsQuery({ limit: 1 }, true);
  const content = useContentListQuery({ limit: 4 });

  const kas = (summary.data?.cashBalances ?? []).reduce((total, account) => total + Number(account.balance), 0);
  const firstName = (session?.user.name ?? 'Pengurus').split(' ')[0];

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-7 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{activeTenant?.rtName ?? 'RT'}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Halo, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ringkasan kondisi RT hari ini.</p>
      </header>

      <OnboardingChecklist />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {can('transactions.read') ? (
          <StatCard icon={<Wallet className="h-5 w-5" aria-hidden="true" />} label="Saldo kas" value={summary.data ? formatIdr(kas) : '—'}
            hint={summary.data ? `${formatIdr(summary.data.totals.income)} masuk · ${formatIdr(summary.data.totals.expense)} keluar` : 'bulan ini'} />
        ) : null}
        {can('residents.read') ? (
          <StatCard icon={<Users className="h-5 w-5" aria-hidden="true" />} label="Warga" value={residents.data ? String(residents.data.total) : '—'} hint="terdaftar" />
        ) : null}
        {can('houses.read') ? (
          <StatCard icon={<Home className="h-5 w-5" aria-hidden="true" />} label="Rumah" value={houses.data ? String(houses.data.total) : '—'} hint="terdata" />
        ) : null}
        {can('approvals.read') ? (
          <StatCard icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />} label="Persetujuan" value={approvals.data ? String(approvals.data.total) : '—'} hint="menunggu" />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Aksi cepat</h2>
        <div className="flex flex-wrap gap-3">
          {can('content.create') ? <QuickAction href="/dashboard/content/new" icon={<Plus className="h-4 w-4" aria-hidden="true" />}>Buat konten</QuickAction> : null}
          {can('transactions.create') ? <QuickAction href="/dashboard/finance/transactions" icon={<Receipt className="h-4 w-4" aria-hidden="true" />}>Catat transaksi</QuickAction> : null}
          {can('residents.read') ? <QuickAction href="/dashboard/residents" icon={<Users className="h-4 w-4" aria-hidden="true" />}>Kelola warga</QuickAction> : null}
          {can('reports.private.read') ? <QuickAction href="/dashboard/reports" icon={<FileText className="h-4 w-4" aria-hidden="true" />}>Laporan</QuickAction> : null}
        </div>
      </section>

      {can('content.read') ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Konten terbaru</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/content">Semua <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
          </div>
          {content.data && content.data.items.length > 0 ? (
            <Card>
              <CardContent className="divide-y p-0">
                {content.data.items.map((row) => (
                  <Link key={row.id} href={`/dashboard/content/${row.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                    <Newspaper className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="block text-xs text-muted-foreground">{row.publishedAt ? `Terbit ${formatDateTime(row.publishedAt)}` : `Dibuat ${formatDateTime(row.createdAt)}`}</span>
                    </span>
                    <ContentTypeBadge type={row.type} />
                    <ContentStatusBadge status={row.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Belum ada konten. <Link href="/dashboard/content/new" className="font-medium text-primary hover:underline">Buat yang pertama</Link>.
              </CardContent>
            </Card>
          )}
        </section>
      ) : null}
    </main>
  );
}

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className="text-primary">{icon}</span>
        </div>
        <p className="mt-2 truncate text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QuickAction({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Button asChild variant="outline">
      <Link href={href}>{icon}{children}</Link>
    </Button>
  );
}
