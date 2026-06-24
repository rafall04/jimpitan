/**
 * Purpose: Complete tenant-aware Residents management page.
 * Caller: App Router /dashboard/residents route.
 * Deps: Structure hooks, forms, status badges, data table, sheets, dialogs, tenant permissions, and toast.
 * MainFuncs: Lists, searches, filters, sorts, creates, updates, archives, reactivates, assigns houses, and shows resident details.
 * SideEffects: Performs tenant-scoped API mutations through TanStack Query hooks.
 */
'use client';

import { Archive, Eye, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, type DataTableColumn } from '@/components/data-table/data-table';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { getResidentActions } from '../components/action-rules';
import { ConfirmActionDialog } from '../components/confirm-action-dialog';
import { toUserMessage } from '../components/error-message';
import { ListSkeleton, PaginationControls, SearchField, SelectField, StructurePageHeader } from '../components/list-shell';
import { DetailItem, DetailList, RecordSheet } from '../components/record-sheet';
import { ResidentForm } from '../components/resident-form';
import { HouseStatusBadge, ResidentStatusBadge } from '../components/status-badge';
import { useAreasQuery, useHousesQuery, useResidentQuery, useResidentsQuery, useStructureMutations } from '../hooks';
import { toCreateResidentPayload, toUpdateResidentPayload, type ResidentFormValues } from '../schemas';
import type { HouseRecord, ResidentListParams, ResidentListRow, ResidentRecord, ResidentStatus } from '../types';

type ResidentSheetState = { mode: 'create' } | { mode: 'detail' | 'edit'; resident: ResidentListRow };

export function ResidentsPage() {
  const { permissions } = useTenantContext();
  const canCreate = permissions.has('residents.create');
  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState('');
  const [houseId, setHouseId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sheet, setSheet] = useState<ResidentSheetState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ResidentListRow | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<ResidentListRow | null>(null);
  const mutations = useStructureMutations();
  const areasQuery = useAreasQuery({ page: 1, limit: 100, isActive: true, sortBy: 'sortOrder', sortDirection: 'asc' });
  const housesQuery = useHousesQuery({ page: 1, limit: 100, sortBy: 'houseNumber', sortDirection: 'asc' });
  const params = useMemo<ResidentListParams>(
    () => ({
      page,
      limit: 20,
      search,
      areaId: areaId || undefined,
      houseId: houseId || undefined,
      status: status ? (status as ResidentStatus) : undefined,
      includeArchived: Boolean(status && status !== 'ACTIVE'),
      sortBy: 'fullName',
      sortDirection,
    }),
    [areaId, houseId, page, search, sortDirection, status],
  );
  const residentsQuery = useResidentsQuery(params);
  const selectedResident = sheet && sheet.mode !== 'create' ? sheet.resident : null;
  const detailQuery = useResidentQuery(selectedResident?.status === 'ACTIVE' ? selectedResident.id : null);
  const activeAreas = areasQuery.data?.items ?? [];
  const assignableHouses = useMemo(() => (housesQuery.data?.items ?? []).filter((house) => house.status !== 'INACTIVE'), [housesQuery.data?.items]);
  const houseOptions = areaId ? assignableHouses.filter((house) => house.areaId === areaId) : assignableHouses;

  async function submitResident(values: ResidentFormValues) {
    try {
      if (sheet?.mode === 'edit') {
        await mutations.updateResident.mutateAsync({ residentId: sheet.resident.id, payload: toUpdateResidentPayload(values) });
        if (values.houseId !== sheet.resident.houseId) {
          await mutations.moveResidentHouse.mutateAsync({ residentId: sheet.resident.id, houseId: values.houseId });
        }
      } else {
        await mutations.createResident.mutateAsync(toCreateResidentPayload(values));
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
      await mutations.archiveResident.mutateAsync(archiveTarget.id);
      setArchiveTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function confirmReactivate() {
    if (!reactivateTarget) {
      return;
    }
    try {
      await mutations.reactivateResident.mutateAsync(reactivateTarget.id);
      setReactivateTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const columns = useMemo<DataTableColumn<ResidentListRow>[]>(
    () => [
      { key: 'name', header: 'Warga', cell: (resident) => <span className="font-medium">{resident.fullName}</span> },
      { key: 'house', header: 'Rumah', cell: (resident) => `${resident.house.area.code} - ${resident.house.houseNumber}` },
      { key: 'phone', header: 'Telepon', cell: (resident) => resident.phone ?? <span className="text-muted-foreground">Tidak ada</span> },
      { key: 'telegram', header: 'Telegram', cell: (resident) => (resident.telegramAccountId ? <span className="text-primary">Tertaut</span> : <span className="text-muted-foreground">Belum tertaut</span>) },
      { key: 'status', header: 'Status', cell: (resident) => <ResidentStatusBadge status={resident.status} /> },
      {
        key: 'actions',
        header: <span className="sr-only">Aksi</span>,
        className: 'text-right',
        cell: (resident) => (
          <ResidentActions
            resident={resident}
            permissions={permissions}
            onDetail={() => setSheet({ mode: 'detail', resident })}
            onEdit={() => setSheet({ mode: 'edit', resident })}
            onArchive={() => setArchiveTarget(resident)}
            onReactivate={() => setReactivateTarget(resident)}
          />
        ),
      },
    ],
    [permissions],
  );

  const detailResident = detailQuery.data ?? toFallbackResident(sheet);

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <StructurePageHeader
        eyebrow="Data warga"
        title="Warga"
        description="Kelola data warga, penugasan rumah, status hunian, nominal jimpitan default, dan keterhubungan Telegram."
        action={
          canCreate ? (
            <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah warga
            </Button>
          ) : null
        }
      />
      <section className="grid gap-3 rounded-xl border bg-card p-4 xl:grid-cols-[minmax(0,1fr)_14rem_14rem_12rem_10rem]">
        <SearchField
          label="Cari warga"
          placeholder="Cari nama, telepon, atau rumah"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <SelectField id="resident-area-filter" label="Area" value={areaId} onChange={(value) => {
          setAreaId(value);
          setHouseId('');
          setPage(1);
        }}>
          <option value="">Semua area</option>
          {activeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="resident-house-filter" label="Rumah" value={houseId} onChange={(value) => {
          setHouseId(value);
          setPage(1);
        }}>
          <option value="">Semua rumah</option>
          {houseOptions.map((house) => (
            <option key={house.id} value={house.id}>
              {house.area.code} - {house.houseNumber}
            </option>
          ))}
        </SelectField>
        <SelectField id="resident-status-filter" label="Status" value={status} onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}>
          <option value="">Data aktif</option>
          <option value="ACTIVE">Aktif</option>
          <option value="INACTIVE">Diarsipkan</option>
          <option value="MOVED">Pindah</option>
        </SelectField>
        <SelectField id="resident-sort-direction" label="Urutan" value={sortDirection} onChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
          <option value="asc">A ke Z</option>
          <option value="desc">Z ke A</option>
        </SelectField>
      </section>
      {residentsQuery.isPending ? <ListSkeleton label="Memuat data warga" /> : null}
      {residentsQuery.isError ? <QueryError onRetry={() => void residentsQuery.refetch()} /> : null}
      {residentsQuery.data ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={residentsQuery.data.items} getRowKey={(resident) => resident.id} emptyTitle="Warga tidak ditemukan" emptyDescription="Sesuaikan filter atau tambah warga setelah ada minimal satu rumah yang bisa ditempati." />
          </div>
          <div className="space-y-3 md:hidden">
            {residentsQuery.data.items.length === 0 ? <EmptyState title="Warga tidak ditemukan" description="Sesuaikan filter atau tambah warga setelah ada minimal satu rumah yang bisa ditempati." /> : null}
            {residentsQuery.data.items.map((resident) => (
              <ResidentCard
                key={resident.id}
                resident={resident}
                permissions={permissions}
                onDetail={() => setSheet({ mode: 'detail', resident })}
                onEdit={() => setSheet({ mode: 'edit', resident })}
                onArchive={() => setArchiveTarget(resident)}
                onReactivate={() => setReactivateTarget(resident)}
              />
            ))}
          </div>
          <PaginationControls page={residentsQuery.data.page} totalPages={residentsQuery.data.totalPages} total={residentsQuery.data.total} onPageChange={setPage} />
        </div>
      ) : null}
      <RecordSheet open={Boolean(sheet)} title={sheetTitle(sheet)} description="Perubahan warga dibatasi per-RT dan diaudit oleh sistem." onOpenChange={(open) => !open && setSheet(null)}>
        {sheet?.mode === 'detail' && detailResident ? <ResidentDetail resident={detailResident} /> : null}
        {sheet?.mode === 'edit' && detailQuery.isPending ? <ListSkeleton label="Memuat detail warga" /> : null}
        {sheet?.mode === 'edit' && detailQuery.isError ? <DetailLoadError /> : null}
        {sheet?.mode === 'create' ? (
          <ResidentForm
            initialResident={null}
            houses={assignableHouses}
            isPending={mutations.createResident.isPending || mutations.updateResident.isPending || mutations.moveResidentHouse.isPending}
            submitLabel="Tambah warga"
            onSubmit={submitResident}
            onCancel={() => setSheet(null)}
          />
        ) : null}
        {sheet?.mode === 'edit' && detailQuery.data ? (
          <ResidentForm
            initialResident={detailQuery.data}
            houses={assignableHouses}
            isPending={mutations.createResident.isPending || mutations.updateResident.isPending || mutations.moveResidentHouse.isPending}
            submitLabel="Simpan perubahan"
            onSubmit={submitResident}
            onCancel={() => setSheet(null)}
          />
        ) : null}
      </RecordSheet>
      <ConfirmActionDialog open={Boolean(archiveTarget)} title="Arsipkan warga" description="Mengarsipkan akan melepas warga dari penugasan aktif. Sistem mencatat tindakan ini di log audit." actionLabel="Arsipkan" destructive isPending={mutations.archiveResident.isPending} onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={confirmArchive} />
      <ConfirmActionDialog open={Boolean(reactivateTarget)} title="Aktifkan kembali warga" description="Mengaktifkan kembali akan memulihkan warga ke rumah yang ditugaskan jika aturan penugasan sistem mengizinkan." actionLabel="Aktifkan kembali" isPending={mutations.reactivateResident.isPending} onOpenChange={(open) => !open && setReactivateTarget(null)} onConfirm={confirmReactivate} />
    </main>
  );
}

function ResidentActions({ resident, permissions, onDetail, onEdit, onArchive, onReactivate }: { resident: ResidentListRow; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void; onReactivate: () => void }) {
  const actions = getResidentActions(resident, permissions);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onDetail} aria-label={`Lihat ${resident.fullName}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {actions.includes('edit') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Ubah ${resident.fullName}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('archive') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onArchive} aria-label={`Arsipkan ${resident.fullName}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('reactivate') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onReactivate} aria-label={`Aktifkan kembali ${resident.fullName}`}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function ResidentCard(props: { resident: ResidentListRow; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void; onReactivate: () => void }) {
  const { resident } = props;
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{resident.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            {resident.house.area.code} - {resident.house.houseNumber}
          </p>
        </div>
        <ResidentStatusBadge status={resident.status} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{resident.telegramAccountId ? 'Telegram tertaut' : 'Telegram belum tertaut'}</span>
        <ResidentActions {...props} />
      </div>
    </article>
  );
}

function ResidentDetail({ resident }: { resident: ResidentRecord }) {
  return (
    <DetailList>
      <DetailItem label="Nama" value={resident.fullName} />
      <DetailItem label="Rumah" value={`${resident.house.area.code} - ${resident.house.houseNumber}`} />
      <DetailItem label="Hunian rumah" value={<HouseStatusBadge status={resident.house.status} />} />
      <DetailItem label="Status" value={<ResidentStatusBadge status={resident.status} />} />
      <DetailItem label="Telepon" value={resident.phone} />
      <DetailItem label="Jimpitan default" value={resident.defaultJimpitanAmount} />
      <DetailItem label="Telegram" value={resident.telegramAccountId ? 'Tertaut' : 'Belum tertaut'} />
      <DetailItem label="Catatan" value={resident.notes} />
      <DetailItem label="Dibuat" value={new Date(resident.createdAt).toLocaleString()} />
      <DetailItem label="Diperbarui" value={new Date(resident.updatedAt).toLocaleString()} />
    </DetailList>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-xl border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Data warga gagal dimuat.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Coba lagi
      </Button>
    </section>
  );
}

function DetailLoadError() {
  return (
    <section className="rounded-xl border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Detail warga gagal dimuat.</p>
      <p className="mt-1 text-sm text-muted-foreground">Tutup panel lalu coba lagi.</p>
    </section>
  );
}

function toFallbackResident(sheet: ResidentSheetState | null): ResidentRecord | null {
  if (!sheet || sheet.mode === 'create') {
    return null;
  }
  return { ...sheet.resident, notes: null };
}

function sheetTitle(sheet: ResidentSheetState | null): string {
  if (!sheet) {
    return 'Warga';
  }
  if (sheet.mode === 'create') {
    return 'Tambah warga';
  }
  return sheet.mode === 'edit' ? `Ubah ${sheet.resident.fullName}` : sheet.resident.fullName;
}
