/**
 * Purpose: Complete tenant-aware Areas management page.
 * Caller: App Router /dashboard/areas route.
 * Deps: Structure hooks, forms, status badges, data table, sheets, dialogs, tenant permissions, and toast.
 * MainFuncs: Lists, searches, filters, sorts, creates, updates, archives, and shows area details.
 * SideEffects: Performs tenant-scoped API mutations through TanStack Query hooks.
 */
'use client';

import { Archive, Eye, MapPinned, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { AreaForm } from '../components/area-form';
import { getAreaActions } from '../components/action-rules';
import { ConfirmActionDialog } from '../components/confirm-action-dialog';
import { toUserMessage } from '../components/error-message';
import { ListSkeleton, PaginationControls, SearchField, SelectField, StructurePageHeader } from '../components/list-shell';
import { DetailItem, DetailList, RecordSheet } from '../components/record-sheet';
import { AreaStatusBadge } from '../components/status-badge';
import { useAreasQuery, useStructureMutations } from '../hooks';
import { toCreateAreaPayload, toUpdateAreaPayload, type AreaFormValues } from '../schemas';
import type { AreaListParams, AreaRecord } from '../types';

type AreaSheetState = { mode: 'create' } | { mode: 'detail' | 'edit'; area: AreaRecord };

export function AreasPage() {
  const { permissions } = useTenantContext();
  const canManage = permissions.has('areas.manage');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sheet, setSheet] = useState<AreaSheetState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AreaRecord | null>(null);
  const mutations = useStructureMutations();
  const params = useMemo<AreaListParams>(
    () => ({
      page,
      limit: 20,
      search,
      isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      sortBy: 'sortOrder',
      sortDirection,
    }),
    [activeFilter, page, search, sortDirection],
  );
  const areasQuery = useAreasQuery(params);

  async function submitArea(values: AreaFormValues) {
    try {
      if (sheet?.mode === 'edit') {
        await mutations.updateArea.mutateAsync({ areaId: sheet.area.id, payload: toUpdateAreaPayload(values) });
      } else {
        await mutations.createArea.mutateAsync(toCreateAreaPayload(values));
      }
      setSheet(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) {
      return;
    }
    try {
      await mutations.archiveArea.mutateAsync(archiveTarget.id);
      setArchiveTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const columns = useMemo<DataTableColumn<AreaRecord>[]>(
    () => [
      { key: 'code', header: 'Kode', cell: (area) => <span className="font-medium">{area.code}</span> },
      { key: 'name', header: 'Nama', cell: (area) => area.name },
      { key: 'sortOrder', header: 'Urutan', cell: (area) => area.sortOrder },
      { key: 'status', header: 'Status', cell: (area) => <AreaStatusBadge isActive={area.isActive} /> },
      {
        key: 'actions',
        header: <span className="sr-only">Aksi</span>,
        className: 'text-right',
        cell: (area) => <AreaActions area={area} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', area })} onEdit={() => setSheet({ mode: 'edit', area })} onArchive={() => setArchiveTarget(area)} />,
      },
    ],
    [permissions],
  );

  const emptyIcon = <MapPinned className="h-7 w-7" aria-hidden="true" />;
  const emptyAction = canManage ? (
    <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      Tambah area
    </Button>
  ) : null;

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <StructurePageHeader
        eyebrow="Data area"
        title="Area"
        description="Kelola rute dan blok RT yang dipakai oleh rumah, warga, dan penugasan jimpitan."
        action={
          canManage ? (
            <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah area
            </Button>
          ) : null
        }
      />
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]">
        <SearchField
          label="Cari area"
          placeholder="Cari berdasarkan kode atau nama"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <SelectField id="area-status-filter" label="Status" value={activeFilter} onChange={(value) => {
          setActiveFilter(value);
          setPage(1);
        }}>
          <option value="active">Aktif</option>
          <option value="archived">Diarsipkan</option>
          <option value="all">Semua</option>
        </SelectField>
        <SelectField id="area-sort-direction" label="Urutan" value={sortDirection} onChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
          <option value="asc">Urutan rute</option>
          <option value="desc">Urutan terbalik</option>
        </SelectField>
      </section>
      {areasQuery.isPending ? <ListSkeleton label="Memuat data area" /> : null}
      {areasQuery.isError ? <QueryError onRetry={() => void areasQuery.refetch()} /> : null}
      {areasQuery.data ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={areasQuery.data.items} getRowKey={(area) => area.id} emptyTitle="Area tidak ditemukan" emptyDescription="Sesuaikan filter atau buat area untuk memulai." emptyIcon={emptyIcon} emptyAction={emptyAction} />
          </div>
          <div className="space-y-3 md:hidden">
            {areasQuery.data.items.length === 0 ? <EmptyState title="Area tidak ditemukan" description="Sesuaikan filter atau buat area untuk memulai." icon={emptyIcon}>{emptyAction}</EmptyState> : null}
            {areasQuery.data.items.map((area) => (
              <AreaCard key={area.id} area={area} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', area })} onEdit={() => setSheet({ mode: 'edit', area })} onArchive={() => setArchiveTarget(area)} />
            ))}
          </div>
          <PaginationControls page={areasQuery.data.page} totalPages={areasQuery.data.totalPages} total={areasQuery.data.total} onPageChange={setPage} />
        </div>
      ) : null}
      <RecordSheet open={Boolean(sheet)} title={sheetTitle(sheet)} description="Perubahan area dibatasi per-RT dan diaudit oleh sistem." onOpenChange={(open) => !open && setSheet(null)}>
        {sheet?.mode === 'detail' ? <AreaDetail area={sheet.area} /> : null}
        {sheet?.mode === 'create' || sheet?.mode === 'edit' ? (
          <AreaForm initialArea={sheet.mode === 'edit' ? sheet.area : null} isPending={mutations.createArea.isPending || mutations.updateArea.isPending} submitLabel={sheet.mode === 'edit' ? 'Simpan perubahan' : 'Tambah area'} onSubmit={submitArea} onCancel={() => setSheet(null)} />
        ) : null}
      </RecordSheet>
      <ConfirmActionDialog open={Boolean(archiveTarget)} title="Arsipkan area" description="Area yang diarsipkan tidak dapat menerima penugasan rumah baru. Aturan sistem mencegah pengarsipan area yang masih memiliki rumah aktif." actionLabel="Arsipkan" destructive isPending={mutations.archiveArea.isPending} onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={confirmArchive} />
    </main>
  );
}

function AreaActions({ area, permissions, onDetail, onEdit, onArchive }: { area: AreaRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const actions = getAreaActions(area, permissions);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onDetail} aria-label={`Lihat ${area.code}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {actions.includes('edit') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Ubah ${area.code}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('archive') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onArchive} aria-label={`Arsipkan ${area.code}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function AreaCard(props: { area: AreaRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const { area } = props;
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{area.code}</h2>
          <p className="text-sm text-muted-foreground">{area.name}</p>
        </div>
        <AreaStatusBadge isActive={area.isActive} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Urutan {area.sortOrder}</span>
        <AreaActions {...props} />
      </div>
    </article>
  );
}

function AreaDetail({ area }: { area: AreaRecord }) {
  return (
    <DetailList>
      <DetailItem label="Kode" value={area.code} />
      <DetailItem label="Nama" value={area.name} />
      <DetailItem label="Urutan" value={area.sortOrder} />
      <DetailItem label="Status" value={<AreaStatusBadge isActive={area.isActive} />} />
      <DetailItem label="Dibuat" value={new Date(area.createdAt).toLocaleString()} />
      <DetailItem label="Diperbarui" value={new Date(area.updatedAt).toLocaleString()} />
    </DetailList>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Data area gagal dimuat.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Coba lagi
      </Button>
    </section>
  );
}

function sheetTitle(sheet: AreaSheetState | null): string {
  if (!sheet) {
    return 'Area';
  }
  if (sheet.mode === 'create') {
    return 'Tambah area';
  }
  return sheet.mode === 'edit' ? `Ubah ${sheet.area.code}` : sheet.area.name;
}
