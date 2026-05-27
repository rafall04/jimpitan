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
      { key: 'houseNumber', header: 'House', cell: (house) => <span className="font-medium">{house.houseNumber}</span> },
      { key: 'area', header: 'Area', cell: (house) => `${house.area.code} - ${house.area.name}` },
      { key: 'status', header: 'Occupancy', cell: (house) => <HouseStatusBadge status={house.status} /> },
      { key: 'residents', header: 'Residents', cell: (house) => house.activeResidentCount },
      {
        key: 'actions',
        header: <span className="sr-only">Actions</span>,
        className: 'text-right',
        cell: (house) => <HouseActions house={house} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', house })} onEdit={() => setSheet({ mode: 'edit', house })} onArchive={() => setArchiveTarget(house)} />,
      },
    ],
    [permissions],
  );

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <StructurePageHeader
        title="Houses"
        description="Manage house inventory, area assignments, occupancy states, and resident capacity signals."
        action={
          canManage ? (
            <Button type="button" onClick={() => setSheet({ mode: 'create' })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New house
            </Button>
          ) : null
        }
      />
      <section className="grid gap-3 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem_10rem]">
        <SearchField
          label="Search houses"
          placeholder="Search by house number"
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
          <option value="">All areas</option>
          {activeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </SelectField>
        <SelectField id="house-status-filter" label="Occupancy" value={status} onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}>
          <option value="">All</option>
          <option value="EMPTY">Empty</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="INACTIVE">Archived</option>
        </SelectField>
        <SelectField id="house-sort-direction" label="Sort" value={sortDirection} onChange={(value) => setSortDirection(value as 'asc' | 'desc')}>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </SelectField>
      </section>
      {housesQuery.isPending ? <ListSkeleton label="Loading houses" /> : null}
      {housesQuery.isError ? <QueryError onRetry={() => void housesQuery.refetch()} /> : null}
      {housesQuery.data ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <DataTable columns={columns} rows={housesQuery.data.items} getRowKey={(house) => house.id} emptyTitle="No houses found" emptyDescription="Adjust filters or create a house after at least one active area exists." />
          </div>
          <div className="space-y-3 md:hidden">
            {housesQuery.data.items.length === 0 ? <EmptyState title="No houses found" description="Adjust filters or create a house after at least one active area exists." /> : null}
            {housesQuery.data.items.map((house) => (
              <HouseCard key={house.id} house={house} permissions={permissions} onDetail={() => setSheet({ mode: 'detail', house })} onEdit={() => setSheet({ mode: 'edit', house })} onArchive={() => setArchiveTarget(house)} />
            ))}
          </div>
          <PaginationControls page={housesQuery.data.page} totalPages={housesQuery.data.totalPages} total={housesQuery.data.total} onPageChange={setPage} />
        </div>
      ) : null}
      <RecordSheet open={Boolean(sheet)} title={sheetTitle(sheet)} description="House changes are tenant-scoped and audited by the backend." onOpenChange={(open) => !open && setSheet(null)}>
        {sheet?.mode === 'detail' ? <HouseDetail house={sheet.house} /> : null}
        {sheet?.mode === 'create' || sheet?.mode === 'edit' ? (
          <HouseForm initialHouse={sheet.mode === 'edit' ? sheet.house : null} areas={activeAreas} isPending={mutations.createHouse.isPending || mutations.updateHouse.isPending} submitLabel={sheet.mode === 'edit' ? 'Update house' : 'Create house'} onSubmit={submitHouse} onCancel={() => setSheet(null)} />
        ) : null}
      </RecordSheet>
      <ConfirmActionDialog open={Boolean(archiveTarget)} title="Archive house" description="Archived houses cannot receive resident assignments. Backend rules block archiving houses with active residents." actionLabel="Archive" destructive isPending={mutations.archiveHouse.isPending} onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={confirmArchive} />
    </main>
  );
}

function HouseActions({ house, permissions, onDetail, onEdit, onArchive }: { house: HouseRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const actions = getHouseActions(house, permissions);
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" size="icon" onClick={onDetail} aria-label={`View house ${house.houseNumber}`}>
        <Eye className="h-4 w-4" aria-hidden="true" />
      </Button>
      {actions.includes('edit') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit house ${house.houseNumber}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
      {actions.includes('archive') ? (
        <Button type="button" variant="ghost" size="icon" onClick={onArchive} aria-label={`Archive house ${house.houseNumber}`}>
          <Archive className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

function HouseCard(props: { house: HouseRecord; permissions: ReadonlySet<string>; onDetail: () => void; onEdit: () => void; onArchive: () => void }) {
  const { house } = props;
  return (
    <article className="rounded-lg border bg-card p-4">
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
        <span className="text-muted-foreground">{house.activeResidentCount} active residents</span>
        <HouseActions {...props} />
      </div>
    </article>
  );
}

function HouseDetail({ house }: { house: HouseRecord }) {
  return (
    <DetailList>
      <DetailItem label="House number" value={house.houseNumber} />
      <DetailItem label="Area" value={`${house.area.code} - ${house.area.name}`} />
      <DetailItem label="Occupancy" value={<HouseStatusBadge status={house.status} />} />
      <DetailItem label="Active residents" value={house.activeResidentCount} />
      <DetailItem label="Address note" value={house.addressNote} />
      <DetailItem label="Created" value={new Date(house.createdAt).toLocaleString()} />
      <DetailItem label="Updated" value={new Date(house.updatedAt).toLocaleString()} />
    </DetailList>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="rounded-lg border bg-card p-4" role="alert">
      <p className="text-sm font-medium">Houses could not be loaded.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </section>
  );
}

function sheetTitle(sheet: HouseSheetState | null): string {
  if (!sheet) {
    return 'House';
  }
  if (sheet.mode === 'create') {
    return 'New house';
  }
  return sheet.mode === 'edit' ? `Edit house ${sheet.house.houseNumber}` : `House ${sheet.house.houseNumber}`;
}
