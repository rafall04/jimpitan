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
      { key: 'name', header: 'Resident', cell: (resident) => <span className="font-medium">{resident.fullName}</span> },
      { key: 'house', header: 'House', cell: (resident) => `${resident.house.area.code} - ${resident.house.houseNumber}` },
      { key: 'phone', header: 'Phone', cell: (resident) => resident.phone ?? <span className="text-muted-foreground">None</span> },
      { key: 'telegram', header: 'Telegram', cell: (resident) => (resident.telegramAccountId ? <span className="text-primary">Bound</span> : <span className="text-muted-foreground">Not bound</span>) },
      { key: 'status', header: 'Status', cell: (resident) => <ResidentStatusBadge status={resident.status} /> },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
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
        title="Residents"
        description="Manage residents, house assignments, occupancy status, collection defaults, and Telegram binding visibility."
        action={
          canCreate ? (
            <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New resident
            </Button>
          ) : null
        }
      />
      <section className="grid gap-3 rounded-lg border bg-card p-4 xl:grid-cols-[minmax(0,1fr)_14rem_14rem_12rem_10rem]">
        <SearchField
          label="Search residents"
          placeholder="Search name, phone, or house"
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
          <option value="">All areas</option>
          {activeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="resident-house-filter" label="House" value={houseId} onChange={(value) => {
          setHouseId(value);
          setPage(1);
        }}>
          <option value="">All houses</option>
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
          <option value="">Active records</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Archived</option>
          <option value="MOVED">Moved</option>
        </SelectField>
        <SelectField id="resident-sort-direction" label="Sort" value={sortDirection} onChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
          <option value="asc">A to Z</option>
          <option value="desc">Z to A</option>
        </SelectField>
      </section>
      {residentsQuery.isPending ? <ListSkeleton label="Loading residents" /> : null}
      {residentsQuery.isError ? <QueryError onRetry={() => void residentsQuery.refetch()} /> : null}
      {residentsQuery.data ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={residentsQuery.data.items} getRowKey={(resident) => resident.id} emptyTitle="No residents found" emptyDescription="Adjust filters or create a resident after at least one assignable house exists." />
          </div>
          <div className="space-y-3 md:hidden">
            {residentsQuery.data.items.length === 0 ? <EmptyState title="No residents found" description="Adjust filters or create a resident after at least one assignable house exists." /> : null}
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
      <RecordSheet open={Boolean(sheet)} title={sheetTitle(sheet)} description="Resident changes are tenant-scoped and audited by the backend." onOpenChange={(open) => !open && setSheet(null)}>
        {sheet?.mode === 'detail' && detailResident ? <ResidentDetail resident={detailResident} /> : null}
        {sheet?.mode === 'edit' && detailQuery.isPending ? <ListSkeleton label="Loading resident detail" /> : null}
        {sheet?.mode === 'edit' && detailQuery.isError ? <DetailLoadError /> : null}
        {sheet?.mode === 'create' ? (
          <ResidentForm
            initialResident={null}
            houses={assignableHouses}
            isPending={mutations.createResident.isPending || mutations.updateResident.isPending || mutations.moveResidentHouse.isPending}
            submitLabel="Create resident"
            onSubmit={submitResident}
            onCancel={() => setSheet(null)}
          />
        ) : null}
        {sheet?.mode === 'edit' && detailQuery.data ? (
          <ResidentForm
            initialResident={detailQuery.data}
            houses={assignableHouses}
            isPending={mutations.createResident.isPending || mutations.updateResident.isPending || mutations.moveResidentHouse.isPending}
            submitLabel="Update resident"
            onSubmit={submitResident}
            onCancel={() => setSheet(null)}
          />
        ) : null}
      </RecordSheet>
      <ConfirmActionDialog open={Boolean(archiveTarget)} title="Archive resident" description="Archiving removes the resident from active assignments. The backend records this action in audit logs." actionLabel="Archive" destructive isPending={mutations.archiveResident.isPending} onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={confirmArchive} />
      <ConfirmActionDialog open={Boolean(reactivateTarget)} title="Reactivate resident" description="Reactivation restores the resident to their assigned house when backend assignment rules allow it." actionLabel="Reactivate" isPending={mutations.reactivateResident.isPending} onOpenChange={(open) => !open && setReactivateTarget(null)} onConfirm={confirmReactivate} />
    </main>
  );
}

function ResidentActions({ resident, permissions, onDetail, onEdit, onArchive, onReactivate }: { resident: ResidentListRow; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void; onReactivate: () => void }) {
  const actions = getResidentActions(resident, permissions);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onDetail} aria-label={`View ${resident.fullName}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {actions.includes('edit') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${resident.fullName}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('archive') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onArchive} aria-label={`Archive ${resident.fullName}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('reactivate') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onReactivate} aria-label={`Reactivate ${resident.fullName}`}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function ResidentCard(props: { resident: ResidentListRow; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void; onReactivate: () => void }) {
  const { resident } = props;
  return (
    <article className="rounded-lg border bg-card p-4">
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
        <span className="text-muted-foreground">{resident.telegramAccountId ? 'Telegram bound' : 'Telegram not bound'}</span>
        <ResidentActions {...props} />
      </div>
    </article>
  );
}

function ResidentDetail({ resident }: { resident: ResidentRecord }) {
  return (
    <DetailList>
      <DetailItem label="Name" value={resident.fullName} />
      <DetailItem label="House" value={`${resident.house.area.code} - ${resident.house.houseNumber}`} />
      <DetailItem label="House occupancy" value={<HouseStatusBadge status={resident.house.status} />} />
      <DetailItem label="Status" value={<ResidentStatusBadge status={resident.status} />} />
      <DetailItem label="Phone" value={resident.phone} />
      <DetailItem label="Default jimpitan" value={resident.defaultJimpitanAmount} />
      <DetailItem label="Telegram" value={resident.telegramAccountId ? 'Bound' : 'Not bound'} />
      <DetailItem label="Notes" value={resident.notes} />
      <DetailItem label="Created" value={new Date(resident.createdAt).toLocaleString()} />
      <DetailItem label="Updated" value={new Date(resident.updatedAt).toLocaleString()} />
    </DetailList>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-lg border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Residents could not be loaded.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </section>
  );
}

function DetailLoadError() {
  return (
    <section className="rounded-lg border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Resident detail could not be loaded.</p>
      <p className="mt-1 text-sm text-muted-foreground">Close the sheet and try again.</p>
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
    return 'Resident';
  }
  if (sheet.mode === 'create') {
    return 'New resident';
  }
  return sheet.mode === 'edit' ? `Edit ${sheet.resident.fullName}` : sheet.resident.fullName;
}
