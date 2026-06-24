/**
 * Purpose: Complete tenant-aware Houses management page.
 * Caller: App Router /dashboard/houses route.
 * Deps: Structure hooks, forms, status badges, data table, sheets, dialogs, tenant permissions, and toast.
 * MainFuncs: Lists, searches, filters, sorts, creates, updates, archives, and shows house details with occupancy state.
 * SideEffects: Performs tenant-scoped API mutations through TanStack Query hooks.
 */
'use client';

import { Archive, Eye, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { getHouseActions } from '../components/action-rules';
import { ConfirmActionDialog } from '../components/confirm-action-dialog';
import { toUserMessage } from '../components/error-message';
import { HouseForm } from '../components/house-form';
import { ListSkeleton, PaginationControls, SearchField, SelectField, StructurePageHeader } from '../components/list-shell';
import { DetailItem, DetailList, RecordSheet } from '../components/record-sheet';
import { HouseStatusBadge } from '../components/status-badge';
import { useAreasQuery, useHousesQuery, useStructureMutations } from '../hooks';
import { toCreateHousePayload, toUpdateHousePayload, type HouseFormValues } from '../schemas';
import type { HouseListParams, HouseRecord, HouseStatus } from '../types';

type HouseSheetState = { mode: 'create' } | { mode: 'detail' | 'edit'; house: HouseRecord };

export function HousesPage() {
  const { permissions } = useTenantContext();
  const canManage = permissions.has('houses.manage');
  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sheet, setSheet] = useState<HouseSheetState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<HouseRecord | null>(null);
  const mutations = useStructureMutations();
  const areasQuery = useAreasQuery({ page: 1, limit: 100, isActive: true, sortBy: 'sortOrder', sortDirection: 'asc' });
  const params = useMemo<HouseListParams>(
    () => ({
      page,
      limit: 20,
      search,
      areaId: areaId || undefined,
      status: status ? (status as HouseStatus) : undefined,
      sortBy: 'houseNumber',
      sortDirection,
    }),
    [areaId, page, search, sortDirection, status],
  );
  const housesQuery = useHousesQuery(params);
  const activeAreas = areasQuery.data?.items ?? [];

  async function submitHouse(values: HouseFormValues) {
    try {
      if (sheet?.mode === 'edit') {
        await mutations.updateHouse.mutateAsync({ houseId: sheet.house.id, payload: toUpdateHousePayload(values) });
      } else {
        await mutations.createHouse.mutateAsync(toCreateHousePayload(values));
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
      await mutations.archiveHouse.mutateAsync(archiveTarget.id);
      setArchiveTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const columns = useMemo<DataTableColumn<HouseRecord>[]>(
    () => [
      { key: 'houseNumber', header: 'Rumah', cell: (house) => <span className="font-medium">{house.houseNumber}</span> },
      { key: 'area', header: 'Area', cell: (house) => `${house.area.code} - ${house.area.name}` },
      { key: 'status', header: 'Hunian', cell: (house) => <HouseStatusBadge status={house.status} /> },
      { key: 'residents', header: 'Warga', cell: (house) => house.activeResidentCount },
      {
        key: 'actions',
        header: <span className="sr-only">Aksi</span>,
        className: 'text-right',
        cell: (house) => <HouseActions house={house} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', house })} onEdit={() => setSheet({ mode: 'edit', house })} onArchive={() => setArchiveTarget(house)} />,
      },
    ],
    [permissions],
  );

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <StructurePageHeader
        eyebrow="Data rumah"
        title="Rumah"
        description="Kelola data rumah, penugasan area, status hunian, dan kapasitas warga."
        action={
          canManage ? (
            <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah rumah
            </Button>
          ) : null
        }
      />
      <section className="grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_10rem]">
        <SearchField
          label="Cari rumah"
          placeholder="Cari berdasarkan nomor rumah"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <SelectField id="house-area-filter" label="Area" value={areaId} onChange={(value) => {
          setAreaId(value);
          setPage(1);
        }}>
          <option value="">Semua area</option>
          {activeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="house-status-filter" label="Hunian" value={status} onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}>
          <option value="">Semua</option>
          <option value="EMPTY">Kosong</option>
          <option value="OCCUPIED">Terisi</option>
          <option value="INACTIVE">Diarsipkan</option>
        </SelectField>
        <SelectField id="house-sort-direction" label="Urutan" value={sortDirection} onChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
          <option value="asc">Menaik</option>
          <option value="desc">Menurun</option>
        </SelectField>
      </section>
      {housesQuery.isPending ? <ListSkeleton label="Memuat data rumah" /> : null}
      {housesQuery.isError ? <QueryError onRetry={() => void housesQuery.refetch()} /> : null}
      {housesQuery.data ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={housesQuery.data.items} getRowKey={(house) => house.id} emptyTitle="Rumah tidak ditemukan" emptyDescription="Sesuaikan filter atau buat rumah setelah ada minimal satu area aktif." />
          </div>
          <div className="space-y-3 md:hidden">
            {housesQuery.data.items.length === 0 ? <EmptyState title="Rumah tidak ditemukan" description="Sesuaikan filter atau buat rumah setelah ada minimal satu area aktif." /> : null}
            {housesQuery.data.items.map((house) => (
              <HouseCard key={house.id} house={house} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', house })} onEdit={() => setSheet({ mode: 'edit', house })} onArchive={() => setArchiveTarget(house)} />
            ))}
          </div>
          <PaginationControls page={housesQuery.data.page} totalPages={housesQuery.data.totalPages} total={housesQuery.data.total} onPageChange={setPage} />
        </div>
      ) : null}
      <RecordSheet open={Boolean(sheet)} title={sheetTitle(sheet)} description="Perubahan rumah dibatasi per-RT dan diaudit oleh sistem." onOpenChange={(open) => !open && setSheet(null)}>
        {sheet?.mode === 'detail' ? <HouseDetail house={sheet.house} /> : null}
        {sheet?.mode === 'create' || sheet?.mode === 'edit' ? (
          <HouseForm initialHouse={sheet.mode === 'edit' ? sheet.house : null} areas={activeAreas} isPending={mutations.createHouse.isPending || mutations.updateHouse.isPending} submitLabel={sheet.mode === 'edit' ? 'Simpan perubahan' : 'Tambah rumah'} onSubmit={submitHouse} onCancel={() => setSheet(null)} />
        ) : null}
      </RecordSheet>
      <ConfirmActionDialog open={Boolean(archiveTarget)} title="Arsipkan rumah" description="Rumah yang diarsipkan tidak dapat menerima penugasan warga. Aturan sistem mencegah pengarsipan rumah yang masih memiliki warga aktif." actionLabel="Arsipkan" destructive isPending={mutations.archiveHouse.isPending} onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={confirmArchive} />
    </main>
  );
}

function HouseActions({ house, permissions, onDetail, onEdit, onArchive }: { house: HouseRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const actions = getHouseActions(house, permissions);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onDetail} aria-label={`Lihat rumah ${house.houseNumber}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {actions.includes('edit') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Ubah rumah ${house.houseNumber}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('archive') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onArchive} aria-label={`Arsipkan rumah ${house.houseNumber}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function HouseCard(props: { house: HouseRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const { house } = props;
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{house.houseNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {house.area.code} - {house.area.name}
          </p>
        </div>
        <HouseStatusBadge status={house.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{house.activeResidentCount} warga aktif</span>
        <HouseActions {...props} />
      </div>
    </article>
  );
}

function HouseDetail({ house }: { house: HouseRecord }) {
  return (
    <DetailList>
      <DetailItem label="Nomor rumah" value={house.houseNumber} />
      <DetailItem label="Area" value={`${house.area.code} - ${house.area.name}`} />
      <DetailItem label="Hunian" value={<HouseStatusBadge status={house.status} />} />
      <DetailItem label="Warga aktif" value={house.activeResidentCount} />
      <DetailItem label="Catatan alamat" value={house.addressNote} />
      <DetailItem label="Dibuat" value={new Date(house.createdAt).toLocaleString()} />
      <DetailItem label="Diperbarui" value={new Date(house.updatedAt).toLocaleString()} />
    </DetailList>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Data rumah gagal dimuat.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Coba lagi
      </Button>
    </section>
  );
}

function sheetTitle(sheet: HouseSheetState | null): string {
  if (!sheet) {
    return 'Rumah';
  }
  if (sheet.mode === 'create') {
    return 'Tambah rumah';
  }
  return sheet.mode === 'edit' ? `Ubah rumah ${sheet.house.houseNumber}` : `Rumah ${sheet.house.houseNumber}`;
}
