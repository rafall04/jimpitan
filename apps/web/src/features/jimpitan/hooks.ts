/**
 * Purpose: TanStack Query hooks for tenant-scoped Jimpitan operational workflows.
 * Caller: Jimpitan dashboard, session detail, and mobile collection pages.
 * Deps: TanStack Query, sonner, tenant context, query keys, Jimpitan API adapter, and workflow types.
 * MainFuncs: Loads sessions/checklists/summaries/outstanding rows and performs lifecycle/item/bulk-total mutations with scoped invalidation.
 * SideEffects: Performs API calls, updates query cache optimistically for one-house item input, and shows toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { queryKeys } from '@/lib/query/query-keys';
import {
  cancelCollection,
  createCollection,
  generateChecklist,
  getChecklist,
  getCollection,
  getCollectionSummary,
  getOutstandingHouses,
  listCollections,
  listTenantMemberships,
  rejectCollection,
  setBulkCollectionTotal,
  startCollection,
  submitCollection,
  upsertCollectionItems,
  validateCollection,
} from './api';
import type { CollectionChecklist, CollectionItemPayload, CollectionListParams, CreateCollectionPayload, SetBulkCollectionTotalPayload } from './types';

export function useCollectionsQuery(params: CollectionListParams, options: { mine?: boolean } = {}) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? (options.mine ? queryKeys.jimpitan.myCollections(activeTenantId, params) : queryKeys.jimpitan.collections(activeTenantId, params)) : ['jimpitan', 'disabled'],
    queryFn: () => listCollections(requiredTenant(activeTenantId), params, options),
    enabled: Boolean(activeTenantId),
  });
}

export function useCollectionQuery(collectionId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && collectionId ? queryKeys.jimpitan.detail(activeTenantId, collectionId) : ['jimpitan', 'detail', 'disabled'],
    queryFn: () => getCollection(requiredTenant(activeTenantId), requiredId(collectionId)),
    enabled: Boolean(activeTenantId && collectionId),
  });
}

export function useChecklistQuery(collectionId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && collectionId ? queryKeys.jimpitan.checklist(activeTenantId, collectionId) : ['jimpitan', 'checklist', 'disabled'],
    queryFn: () => getChecklist(requiredTenant(activeTenantId), requiredId(collectionId)),
    enabled: Boolean(activeTenantId && collectionId),
  });
}

export function useSummaryQuery(collectionId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && collectionId ? queryKeys.jimpitan.summary(activeTenantId, collectionId) : ['jimpitan', 'summary', 'disabled'],
    queryFn: () => getCollectionSummary(requiredTenant(activeTenantId), requiredId(collectionId)),
    enabled: Boolean(activeTenantId && collectionId),
  });
}

export function useOutstandingQuery(collectionId: string | null, params: { page?: number; limit?: number } = { page: 1, limit: 20 }) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && collectionId ? queryKeys.jimpitan.outstanding(activeTenantId, collectionId, params) : ['jimpitan', 'outstanding', 'disabled'],
    queryFn: () => getOutstandingHouses(requiredTenant(activeTenantId), requiredId(collectionId), params),
    enabled: Boolean(activeTenantId && collectionId),
  });
}

export function useMembershipsQuery() {
  const { activeTenantId, permissions } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.jimpitan.memberships(activeTenantId) : ['jimpitan', 'memberships', 'disabled'],
    queryFn: () => listTenantMemberships(requiredTenant(activeTenantId)),
    enabled: Boolean(activeTenantId && permissions.has('users.read')),
    retry: false,
  });
}

export function useJimpitanMutations(collectionId?: string) {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const invalidateAll = async () => {
    const tenantId = requiredTenant(activeTenantId);
    await queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.scope(tenantId) });
  };
  const invalidateCollection = async (id: string) => {
    const tenantId = requiredTenant(activeTenantId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.detail(tenantId, id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.checklist(tenantId, id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.summary(tenantId, id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.scope(tenantId) }),
    ]);
  };

  return {
    create: useMutation({
      mutationFn: (payload: CreateCollectionPayload) => createCollection(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidateAll();
        toast.success('Collection session created');
      },
    }),
    start: useMutation({
      mutationFn: (id: string) => startCollection(requiredTenant(activeTenantId), id),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection started');
      },
    }),
    generateChecklist: useMutation({
      mutationFn: (id: string) => generateChecklist(requiredTenant(activeTenantId), id),
      onSuccess: async (checklist) => {
        await invalidateCollection(checklist.collection.id);
        toast.success('Checklist ready');
      },
    }),
    upsertItem: useMutation({
      mutationFn: ({ id, item }: { id: string; item: CollectionItemPayload }) => upsertCollectionItems(requiredTenant(activeTenantId), id, { items: [item] }),
      onMutate: async ({ id, item }) => {
        const tenantId = requiredTenant(activeTenantId);
        const key = queryKeys.jimpitan.checklist(tenantId, id);
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData<CollectionChecklist>(key);
        if (previous) {
          queryClient.setQueryData<CollectionChecklist>(key, {
            ...previous,
            houses: previous.houses.map((house) =>
              house.houseId === item.houseId
                ? {
                    ...house,
                    item: { id: `optimistic-${item.houseId}`, houseId: item.houseId, residentId: item.residentId ?? null, amount: item.amount, status: item.status, note: item.note ?? null, updatedAt: new Date().toISOString() },
                  }
                : house,
            ),
          });
        }
        return { previous, key };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(context.key, context.previous);
        }
      },
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
      },
    }),
    setBulkTotal: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: SetBulkCollectionTotalPayload }) => setBulkCollectionTotal(requiredTenant(activeTenantId), id, payload),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection total saved');
      },
    }),
    submit: useMutation({
      mutationFn: (id: string) => submitCollection(requiredTenant(activeTenantId), id),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection submitted');
      },
    }),
    validate: useMutation({
      mutationFn: ({ id, note }: { id: string; note?: string }) => validateCollection(requiredTenant(activeTenantId), id, note),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection validated');
      },
    }),
    reject: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectCollection(requiredTenant(activeTenantId), id, reason),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection rejected');
      },
    }),
    cancel: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelCollection(requiredTenant(activeTenantId), id, reason),
      onSuccess: async (collection) => {
        await invalidateCollection(collection.id);
        toast.success('Collection cancelled');
      },
    }),
    collectionId,
  };
}

function requiredTenant(activeTenantId: string | undefined): string {
  if (!activeTenantId) {
    throw new Error('Active tenant is required.');
  }
  return activeTenantId;
}

function requiredId(id: string | null): string {
  if (!id) {
    throw new Error('Collection id is required.');
  }
  return id;
}
