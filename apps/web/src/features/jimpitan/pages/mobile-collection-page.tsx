/**
 * Purpose: Mobile-first Jimpitan field collection workflow for rapid house-by-house or bulk total input.
 * Caller: App Router /dashboard/jimpitan/mobile/[sessionId] route.
 * Deps: Jimpitan hooks, mobile item panel, workflow helpers, tenant permissions, and status badges.
 * MainFuncs: Resumes a mode-aware workflow, saves house items or a bulk total, and exposes submit when lifecycle allows.
 * SideEffects: Performs tenant-scoped item, bulk total, and lifecycle mutations through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { MobileItemPanel } from '../components/mobile-item-panel';
import { BulkTotalPanel } from '../components/bulk-total-panel';
import { ProgressBar } from '../components/progress';
import { CollectionStatusBadge, ItemStatusBadge } from '../components/status-badge';
import { toUserMessage } from '../components/error-message';
import { useChecklistQuery, useJimpitanMutations, useSummaryQuery } from '../hooks';
import { getCollectionModeWorkflow } from '../collection-mode-workflow';
import { getCollectionActions, getCompletedCount, getNextHouseId, getProgressPercent, isEditableCollection } from '../workflow';
import type { CollectionChecklistHouse, CollectionItemPayload, CollectionStatus, SetBulkCollectionTotalPayload } from '../types';

export function MobileCollectionPage({ collectionId }: { collectionId: string }) {
  const { permissions, activeTenant } = useTenantContext();
  const checklistQuery = useChecklistQuery(collectionId);
  const summaryQuery = useSummaryQuery(collectionId);
  const mutations = useJimpitanMutations(collectionId);
  const [currentHouseId, setCurrentHouseId] = useState<string | null>(null);
  const checklist = checklistQuery.data;
  const collection = checklist?.collection;
  const modeWorkflow = collection ? getCollectionModeWorkflow(collection) : null;
  const houses = checklist?.houses ?? [];
  const currentIndex = houses.findIndex((house) => house.houseId === currentHouseId);
  const currentHouse = currentIndex >= 0 ? houses[currentIndex] : houses[0];
  const membershipId = activeTenant?.id;
  const actions = collection ? getCollectionActions(collection, permissions, membershipId) : [];
  const canInput = Boolean(collection && isEditableCollection(collection) && (permissions.has('collections.validate') || (membershipId && collection.officerMembershipId === membershipId)));
  const completed = summaryQuery.data?.completedHouses ?? getCompletedCount(houses);
  const total = summaryQuery.data?.totalHouses ?? houses.length;
  const progress = getProgressPercent({ completedHouses: completed, totalHouses: total });

  useEffect(() => {
    if (!houses.length || currentHouseId) {
      return;
    }
    setCurrentHouseId(getNextHouseId(houses, null) ?? houses[0]?.houseId ?? null);
  }, [currentHouseId, houses]);

  async function saveItem(item: CollectionItemPayload) {
    if (!collection || !currentHouse) {
      return;
    }
    try {
      await mutations.upsertItem.mutateAsync({ id: collection.id, item });
      const patched = houses.map((house) =>
        house.houseId === item.houseId
          ? { ...house, item: { id: house.item?.id ?? `local-${house.houseId}`, houseId: item.houseId, residentId: item.residentId ?? null, amount: item.amount, status: item.status, note: item.note ?? null, updatedAt: new Date().toISOString() } }
          : house,
      );
      const nextId = getNextHouseId(patched, item.houseId);
      if (nextId) {
        setCurrentHouseId(nextId);
      }
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function submit() {
    if (!collection) {
      return;
    }
    try {
      await mutations.submit.mutateAsync(collection.id);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function saveBulkTotal(payload: SetBulkCollectionTotalPayload) {
    if (!collection) {
      return;
    }
    try {
      await mutations.setBulkTotal.mutateAsync({ id: collection.id, payload });
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  if (checklistQuery.isPending) {
    return <MobileSkeleton />;
  }

  if (checklistQuery.isError || !collection) {
    return (
      <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href={`/dashboard/jimpitan/sessions/${collectionId}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Session
          </Link>
        </Button>
        <section className="rounded-lg border bg-card p-4" role="alert">
          <p className="text-sm font-medium">Collection checklist could not be loaded.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void checklistQuery.refetch()}>
            Retry
          </Button>
        </section>
      </main>
    );
  }

  if (modeWorkflow?.showsBulkTotalInput) {
    return (
      <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <Header collectionId={collection.id} status={collection.status} />
        <section className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{collection.route.areaName ?? 'All areas'}</p>
              <p className="text-xs text-muted-foreground">Bulk total session</p>
            </div>
            <p className="text-lg font-semibold">Rp{Number(collection.totalAmount).toLocaleString('id-ID')}</p>
          </div>
        </section>
        {!canInput ? (
          <section className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Input is locked</p>
              <p className="text-sm text-muted-foreground">This session is not editable for your role or current lifecycle status.</p>
            </div>
          </section>
        ) : null}
        <BulkTotalPanel collection={collection} isPending={!canInput || mutations.setBulkTotal.isPending} onSubmit={saveBulkTotal} />
        {actions.includes('submit') ? (
          <Button type="button" className="mt-auto min-h-12 w-full" disabled={mutations.submit.isPending} onClick={() => void submit()}>
            Submit for validation
          </Button>
        ) : null}
      </main>
    );
  }

  if (!houses.length) {
    return (
      <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5">
        <Header collectionId={collection.id} status={collection.status} />
        <EmptyState title="Checklist is empty" description="Generate the session checklist before opening field input." />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 bg-background px-4 py-5">
      <Header collectionId={collection.id} status={collection.status} />
      <section className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{collection.route.areaName ?? 'All areas'}</p>
            <p className="text-xs text-muted-foreground">{completed}/{total} houses complete</p>
          </div>
          <p className="text-lg font-semibold">{progress}%</p>
        </div>
        <ProgressBar className="mt-3" completed={completed} total={total} />
      </section>

      {!canInput ? (
        <section className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Input is locked</p>
            <p className="text-sm text-muted-foreground">This session is not editable for your role or current lifecycle status.</p>
          </div>
        </section>
      ) : null}

      <HouseNavigator houses={houses} currentHouse={currentHouse} onSelect={setCurrentHouseId} />

      {currentHouse ? <MobileItemPanel house={currentHouse} isPending={!canInput || mutations.upsertItem.isPending} onSave={saveItem} /> : null}

      <div className="sticky bottom-0 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" className="min-h-12" disabled={currentIndex <= 0} onClick={() => setCurrentHouseId(houses[Math.max(0, currentIndex - 1)]?.houseId ?? currentHouseId)}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Button>
          <Button type="button" variant="outline" className="min-h-12" disabled={currentIndex < 0 || currentIndex >= houses.length - 1} onClick={() => setCurrentHouseId(houses[Math.min(houses.length - 1, currentIndex + 1)]?.houseId ?? currentHouseId)}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {actions.includes('submit') ? (
          <Button type="button" className="mt-2 min-h-12 w-full" disabled={mutations.submit.isPending} onClick={() => void submit()}>
            Submit for validation
          </Button>
        ) : null}
      </div>
    </main>
  );
}

function Header({ collectionId, status }: { collectionId: string; status: CollectionStatus }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link href={`/dashboard/jimpitan/sessions/${collectionId}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Detail
        </Link>
      </Button>
      <CollectionStatusBadge status={status} />
    </div>
  );
}

function HouseNavigator({ houses, currentHouse, onSelect }: { houses: CollectionChecklistHouse[]; currentHouse: CollectionChecklistHouse | undefined; onSelect: (houseId: string) => void }) {
  return (
    <section aria-label="House selector" className="-mx-4 overflow-x-auto px-4">
      <div className="flex gap-2 pb-1">
        {houses.map((house, index) => {
          const active = house.houseId === currentHouse?.houseId;
          return (
            <button
              key={house.houseId}
              type="button"
              className={`min-h-12 min-w-16 rounded-md border px-3 py-2 text-left text-sm ${active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}
              onClick={() => onSelect(house.houseId)}
              aria-pressed={active}
            >
              <span className="block text-xs opacity-80">#{index + 1}</span>
              <span className="block font-semibold">{house.houseNumber}</span>
              {house.item ? <span className="mt-1 block text-xs">{house.item.status}</span> : null}
            </button>
          );
        })}
      </div>
      {currentHouse?.item ? (
        <div className="mt-2">
          <ItemStatusBadge status={currentHouse.item.status} />
        </div>
      ) : null}
    </section>
  );
}

function MobileSkeleton() {
  return (
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-5">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-96 w-full" />
    </main>
  );
}
