/**
 * Purpose: Complete tenant-aware Jimpitan collection session list and creation page.
 * Caller: App Router /dashboard/jimpitan and /dashboard/jimpitan/sessions routes.
 * Deps: Jimpitan hooks, structure area hook, tenant context, session form, cards, sheets, and list controls.
 * MainFuncs: Lists sessions with status/mode filters, shows officer/mobile sessions, creates sessions, and links detail/mobile workflows.
 * SideEffects: Performs tenant-scoped collection creation through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { useAreasQuery } from '@/features/structure/hooks';
import { ListSkeleton, PaginationControls, SearchField, SelectField, StructurePageHeader } from '@/features/structure/components/list-shell';
import { membershipRowsFromSession } from '../membership-options';
import { toCreateCollectionPayload, type CreateCollectionValues } from '../schemas';
import { SessionCard } from '../components/session-card';
import { SessionForm } from '../components/session-form';
import { toUserMessage } from '../components/error-message';
import { useCollectionsQuery, useJimpitanMutations, useMembershipsQuery } from '../hooks';
import type { CollectionListParams, CollectionMode, CollectionStatus } from '../types';

export function SessionsPage({ dashboard = false }: { dashboard?: boolean }) {
  const { permissions, activeTenant, session } = useTenantContext();
  const canCreate = permissions.has('collections.create');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CollectionStatus | ''>(dashboard ? 'IN_PROGRESS' : '');
  const [collectionMode, setCollectionMode] = useState<CollectionMode | ''>('');
  const [page, setPage] = useState(1);
  const params = useMemo<CollectionListParams>(
    () => ({ page, limit: dashboard ? 6 : 20, search, status: status || undefined, collectionMode: collectionMode || undefined, sortBy: 'collectionDate', sortDirection: 'desc' }),
    [collectionMode, dashboard, page, search, status],
  );
  const collectionsQuery = useCollectionsQuery(params);
  const myCollectionsQuery = useCollectionsQuery({ page: 1, limit: 4, status: 'IN_PROGRESS', sortBy: 'collectionDate', sortDirection: 'desc' }, { mine: true });
  const membershipsQuery = useMembershipsQuery();
  const areasQuery = useAreasQuery({ page: 1, limit: 100, isActive: true, sortBy: 'sortOrder', sortDirection: 'asc' });
  const mutations = useJimpitanMutations();
  const fallbackOfficers = membershipRowsFromSession(session, activeTenant);
  const officers = membershipsQuery.data?.items.length ? membershipsQuery.data.items.filter((membership) => membership.status === 'ACTIVE') : fallbackOfficers;

  async function submitCreate(values: CreateCollectionValues) {
    try {
      await mutations.create.mutateAsync(toCreateCollectionPayload(values));
      setSheetOpen(false);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <StructurePageHeader
        eyebrow="Jimpitan"
        title={dashboard ? 'Operasional Jimpitan' : 'Sesi penarikan'}
        description="Pantau progres di lapangan, jalankan validasi, dan buka alur penarikan cepat versi mobile."
        action={
          <div className="flex gap-2">
            {dashboard ? (
              <Button asChild variant="outline">
                <Link href="/dashboard/jimpitan/sessions">Semua sesi</Link>
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" onClick={() => setSheetOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Sesi baru
              </Button>
            ) : null}
          </div>
        }
      />
      {dashboard ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Rute aktif saya</h2>
          {myCollectionsQuery.isPending ? <ListSkeleton label="Memuat sesi yang ditugaskan" /> : null}
          {myCollectionsQuery.data?.items.length === 0 ? <EmptyState title="Belum ada rute aktif" description="Rute yang sedang berjalan dan ditugaskan kepada Anda akan muncul di sini." /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {myCollectionsQuery.data?.items.map((collection) => <SessionCard key={collection.id} collection={collection} />)}
          </div>
        </section>
      ) : null}
      <section className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_13rem_13rem]">
        <SearchField
          label="Cari sesi"
          placeholder="Cari petugas atau rute"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <SelectField id="collection-status-filter" label="Status" value={status} onChange={(value) => {
          setStatus(value as CollectionStatus | '');
          setPage(1);
        }}>
          <option value="">Semua status</option>
          <option value="DRAFT">Draf</option>
          <option value="IN_PROGRESS">Berlangsung</option>
          <option value="SUBMITTED">Diajukan</option>
          <option value="VALIDATED">Tervalidasi</option>
          <option value="REJECTED">Ditolak</option>
          <option value="CANCELLED">Dibatalkan</option>
        </SelectField>
        <SelectField id="collection-mode-filter" label="Mode" value={collectionMode} onChange={(value) => {
          setCollectionMode(value as CollectionMode | '');
          setPage(1);
        }}>
          <option value="">Semua mode</option>
          <option value="PER_HOUSE">Per rumah</option>
          <option value="BULK_TOTAL">Total langsung</option>
        </SelectField>
      </section>
      {collectionsQuery.isPending ? <ListSkeleton label="Memuat sesi" /> : null}
      {collectionsQuery.isError ? <QueryError onRetry={() => void collectionsQuery.refetch()} /> : null}
      {collectionsQuery.data ? (
        <div className="space-y-4">
          {collectionsQuery.data.items.length === 0 ? <EmptyState title="Tidak ada sesi" description="Sesuaikan filter atau buat sesi penarikan baru." /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {collectionsQuery.data.items.map((collection) => <SessionCard key={collection.id} collection={collection} />)}
          </div>
          <PaginationControls page={collectionsQuery.data.page} totalPages={collectionsQuery.data.totalPages} total={collectionsQuery.data.total} onPageChange={setPage} />
        </div>
      ) : null}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem]">
          <SheetHeader>
            <SheetTitle>Sesi penarikan baru</SheetTitle>
            <SheetDescription>Buat sesi rute untuk penarikan jimpitan di lapangan.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <SessionForm defaultOfficerMembershipId={activeTenant?.id ?? ''} officers={officers} areas={areasQuery.data?.items ?? []} isPending={mutations.create.isPending} onSubmit={submitCreate} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Sesi penarikan gagal dimuat.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Coba lagi
      </Button>
    </section>
  );
}
