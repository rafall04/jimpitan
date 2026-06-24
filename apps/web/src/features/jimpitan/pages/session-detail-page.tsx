/**
 * Purpose: Tenant-aware Jimpitan collection session detail and validation workspace.
 * Caller: App Router /dashboard/jimpitan/sessions/[id] route.
 * Deps: Jimpitan hooks, lifecycle actions, progress widgets, status badges, tenant context, and workflow helpers.
 * MainFuncs: Shows mode-aware route progress, totals, bulk total input, outstanding houses, checklist status, officer assignment, lifecycle actions, and activity timeline.
 * SideEffects: Performs tenant-scoped lifecycle and bulk total mutations through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { LifecycleActions } from '../components/lifecycle-actions';
import { BulkTotalPanel } from '../components/bulk-total-panel';
import { AmountMetric, Metric, ProgressBar } from '../components/progress';
import { CollectionStatusBadge, ItemStatusBadge, formatCollectionModeLabel } from '../components/status-badge';
import { toUserMessage } from '../components/error-message';
import { useChecklistQuery, useCollectionQuery, useJimpitanMutations, useOutstandingQuery, useSummaryQuery } from '../hooks';
import { getCollectionModeWorkflow } from '../collection-mode-workflow';
import { formatCurrencyAmount, getProgressPercent, isEditableCollection } from '../workflow';
import type { CollectionChecklistHouse, CollectionSessionRecord, SetBulkCollectionTotalPayload } from '../types';

export function SessionDetailPage({ collectionId }: { collectionId: string }) {
  const { permissions, activeTenant } = useTenantContext();
  const collectionQuery = useCollectionQuery(collectionId);
  const checklistQuery = useChecklistQuery(collectionId);
  const summaryQuery = useSummaryQuery(collectionId);
  const outstandingQuery = useOutstandingQuery(collectionId, { page: 1, limit: 20 });
  const mutations = useJimpitanMutations(collectionId);
  const collection = collectionQuery.data ?? checklistQuery.data?.collection;
  const modeWorkflow = collection ? getCollectionModeWorkflow(collection) : null;
  const membershipId = activeTenant?.id;
  const canMutateOwn = Boolean(membershipId && collection?.officerMembershipId === membershipId);
  const summary = summaryQuery.data;
  const completion = summary
    ? getProgressPercent({ completedHouses: summary.completedHouses, totalHouses: summary.totalHouses })
    : getProgressPercent({ completedHouses: collection?.itemCount ?? 0, totalHouses: checklistQuery.data?.houses.length ?? 0 });
  const timeline = useMemo(() => (collection ? buildTimeline(collection) : []), [collection]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function saveBulkTotal(payload: SetBulkCollectionTotalPayload) {
    if (!collection) {
      return;
    }
    await run(() => mutations.setBulkTotal.mutateAsync({ id: collection.id, payload }));
  }

  if (collectionQuery.isPending) {
    return <DetailSkeleton />;
  }

  if (collectionQuery.isError || !collection) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-xl border bg-card p-4" role="alert">
          <p className="text-sm font-medium">Sesi penarikan gagal dimuat.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void collectionQuery.refetch()}>
            Coba lagi
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="w-fit px-0">
            <Link href="/dashboard/jimpitan/sessions">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Sesi
            </Link>
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Jimpitan</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Sesi penarikan</h1>
              <CollectionStatusBadge status={collection.status} />
              <span className="rounded-full border px-2 py-1 text-xs font-medium">{formatCollectionModeLabel(collection.collectionMode)}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {collection.route.areaName ?? 'Semua wilayah'} - {new Date(collection.collectionDate).toLocaleDateString('id-ID')} - {collection.officer.fullName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/dashboard/jimpitan/mobile/${collection.id}`}>
              <Smartphone className="h-4 w-4" aria-hidden="true" />
              Alur mobile
            </Link>
          </Button>
          <LifecycleActions
            collection={collection}
            permissions={permissions}
            membershipId={membershipId}
            isPending={mutations.start.isPending || mutations.generateChecklist.isPending || mutations.setBulkTotal.isPending || mutations.submit.isPending || mutations.validate.isPending || mutations.reject.isPending || mutations.cancel.isPending}
            onStart={() => void run(() => mutations.start.mutateAsync(collection.id))}
            onGenerate={() => void run(() => mutations.generateChecklist.mutateAsync(collection.id))}
            onSubmit={() => void run(() => mutations.submit.mutateAsync(collection.id))}
            onValidate={(note) => void run(() => mutations.validate.mutateAsync({ id: collection.id, note }))}
            onReject={(reason) => void run(() => mutations.reject.mutateAsync({ id: collection.id, reason }))}
            onCancel={(reason) => void run(() => mutations.cancel.mutateAsync({ id: collection.id, reason }))}
          />
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <AmountMetric label="Terkumpul" amount={summary?.totalCollected ?? collection.totalAmount} />
        <Metric label="Mode" value={formatCollectionModeLabel(collection.collectionMode)} />
        <Metric label={modeWorkflow?.showsHouseChecklist ? 'Rumah selesai' : 'Sumber total'} value={modeWorkflow?.showsHouseChecklist ? `${summary?.completedHouses ?? collection.itemCount}/${summary?.totalHouses ?? checklistQuery.data?.houses.length ?? '-'}` : 'Total sesi'} />
        <Metric label="Belum disetor" value={modeWorkflow?.showsOutstandingHouses ? String(summary?.outstandingHouses ?? '-') : '-'} />
      </section>

      {modeWorkflow?.showsBulkTotalInput ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Input total langsung</h2>
          <p className="mb-4 text-sm text-muted-foreground">Sesi ini hanya mencatat total nominal yang terkumpul.</p>
          <BulkTotalPanel collection={collection} isPending={mutations.setBulkTotal.isPending || !isEditableCollection(collection)} onSubmit={saveBulkTotal} />
        </section>
      ) : null}

      {modeWorkflow?.showsHouseChecklist ? (
        <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Progres rute</h2>
            <p className="text-sm text-muted-foreground">{completion}% selesai dari daftar rumah yang ditugaskan.</p>
          </div>
          <div className="w-full max-w-xs">
            <ProgressBar completed={completion} total={100} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summary?.perArea.length ? (
            summary.perArea.map((area) => (
              <div key={area.areaId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{area.areaName}</p>
                    <p className="text-xs text-muted-foreground">{area.areaCode}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrencyAmount(area.totalCollected)}</p>
                </div>
                <ProgressBar className="mt-3" completed={area.completedHouses} total={area.totalHouses} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {area.completedHouses}/{area.totalHouses} selesai - {area.outstandingHouses} belum disetor
                </p>
              </div>
            ))
          ) : (
            <EmptyState title="Belum ada progres wilayah" description="Buat daftar rumah atau simpan setoran untuk mengisi progres." />
          )}
        </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {modeWorkflow?.showsHouseChecklist ? (
          <section className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <h2 className="text-base font-semibold">Daftar rumah</h2>
              <p className="text-sm text-muted-foreground">Status setoran terbaru per rumah.</p>
            </div>
            {isEditableCollection(collection) && canMutateOwn ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/jimpitan/mobile/${collection.id}`}>Lanjutkan</Link>
              </Button>
            ) : null}
          </div>
          <Separator />
          {checklistQuery.isPending ? <ChecklistSkeleton /> : null}
          {checklistQuery.data?.houses.length === 0 ? <EmptyState title="Daftar rumah masih kosong" description="Buat daftar rumah rute sebelum petugas mulai menarik." /> : null}
          {checklistQuery.data?.houses.length ? <ChecklistRows houses={checklistQuery.data.houses} /> : null}
          </section>
        ) : (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Input setoran</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sesi ini tidak membuat baris setoran per rumah.</p>
          </section>
        )}

        <aside className="space-y-5">
          {modeWorkflow?.showsOutstandingHouses ? (
            <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Belum disetor</h2>
            <p className="mb-3 text-sm text-muted-foreground">Rumah yang masih perlu ditindaklanjuti.</p>
            {outstandingQuery.isPending ? <Skeleton className="h-20 w-full" /> : null}
            {outstandingQuery.data?.items.length === 0 ? <EmptyState title="Semua rumah sudah disetor" description="Seluruh rumah pada daftar telah selesai." /> : null}
            <div className="space-y-2">
              {outstandingQuery.data?.items.map((house) => (
                <div key={house.houseId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Rumah {house.houseNumber}</p>
                    {house.outstandingStatus === 'NO_INPUT' ? <span className="rounded-full border px-2 py-1 text-xs font-medium">Belum diisi</span> : <ItemStatusBadge status={house.outstandingStatus} />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{house.primaryResident?.fullName ?? 'Tidak ada warga aktif'}</p>
                </div>
              ))}
            </div>
            </section>
          ) : null}
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Linimasa aktivitas</h2>
            <ol className="mt-3 space-y-3">
              {timeline.map((item) => (
                <li key={`${item.label}-${item.date}`} className="border-l-2 border-muted pl-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(item.date).toLocaleString('id-ID')}</p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

function ChecklistRows({ houses }: { houses: CollectionChecklistHouse[] }) {
  return (
    <div className="divide-y">
      {houses.map((house) => (
        <div key={house.houseId} className="grid gap-2 p-4 sm:grid-cols-[8rem_minmax(0,1fr)_8rem_7rem] sm:items-center">
          <div>
            <p className="font-medium">Rumah {house.houseNumber}</p>
            <p className="text-xs text-muted-foreground">{house.area.name}</p>
          </div>
          <p className="text-sm text-muted-foreground">{house.primaryResident?.fullName ?? 'Tidak ada warga aktif'}</p>
          <p className="text-sm font-medium">{house.item ? formatCurrencyAmount(house.item.amount) : '-'}</p>
          {house.item ? <ItemStatusBadge status={house.item.status} /> : <span className="text-xs text-muted-foreground">Belum diisi</span>}
        </div>
      ))}
    </div>
  );
}

function buildTimeline(collection: CollectionSessionRecord) {
  return [
    { label: 'Dibuat untuk tanggal penarikan', date: collection.collectionDate },
    collection.submittedAt ? { label: 'Diajukan', date: collection.submittedAt } : null,
    collection.validatedAt ? { label: 'Tervalidasi', date: collection.validatedAt } : null,
    collection.rejectedAt ? { label: 'Ditolak', date: collection.rejectedAt } : null,
    collection.cancelledAt ? { label: 'Dibatalkan', date: collection.cancelledAt } : null,
    { label: 'Terakhir diperbarui', date: collection.updatedAt },
  ].filter(Boolean) as Array<{ label: string; date: string }>;
}

function DetailSkeleton() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-3 md:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </main>
  );
}

function ChecklistSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
