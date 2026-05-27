/**
 * Purpose: TanStack Query hooks for tenant-scoped Residents/Houses/Areas data and mutations.
 * Caller: Structure pages and forms.
 * Deps: TanStack Query, sonner toasts, tenant context, query keys, and structure API adapter.
 * MainFuncs: Loads paginated lists/details and invalidates scoped caches after CRUD mutations.
 * SideEffects: Performs API calls, updates query cache, and shows non-sensitive toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { queryKeys } from '@/lib/query/query-keys';
import {
  archiveArea,
  archiveHouse,
  archiveResident,
  createArea,
  createHouse,
  createResident,
  getArea,
  getHouse,
  getResident,
  listAreas,
  listHouses,
  listResidents,
  moveResidentHouse,
  reactivateResident,
  updateArea,
  updateHouse,
  updateResident,
} from './api';
import type {
  AreaListParams,
  CreateAreaPayload,
  CreateHousePayload,
  CreateResidentPayload,
  HouseListParams,
  ResidentListParams,
  UpdateAreaPayload,
  UpdateHousePayload,
  UpdateResidentPayload,
} from './types';

export function useAreasQuery(params: AreaListParams) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.areas.list(activeTenantId, params) : ['areas', 'disabled'],
    queryFn: () => listAreas(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useAreaQuery(areaId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && areaId ? queryKeys.areas.detail(activeTenantId, areaId) : ['areas', 'detail', 'disabled'],
    queryFn: () => getArea(requiredTenant(activeTenantId), requiredId(areaId)),
    enabled: Boolean(activeTenantId && areaId),
  });
}

export function useHousesQuery(params: HouseListParams) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.houses.list(activeTenantId, params) : ['houses', 'disabled'],
    queryFn: () => listHouses(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useHouseQuery(houseId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && houseId ? queryKeys.houses.detail(activeTenantId, houseId) : ['houses', 'detail', 'disabled'],
    queryFn: () => getHouse(requiredTenant(activeTenantId), requiredId(houseId)),
    enabled: Boolean(activeTenantId && houseId),
  });
}

export function useResidentsQuery(params: ResidentListParams) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.residents.list(activeTenantId, params) : ['residents', 'disabled'],
    queryFn: () => listResidents(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useResidentQuery(residentId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && residentId ? queryKeys.residents.detail(activeTenantId, residentId) : ['residents', 'detail', 'disabled'],
    queryFn: () => getResident(requiredTenant(activeTenantId), requiredId(residentId)),
    enabled: Boolean(activeTenantId && residentId),
  });
}

export function useStructureMutations() {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const invalidate = async () => {
    const tenantId = requiredTenant(activeTenantId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.scope(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.houses.scope(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.residents.scope(tenantId) }),
    ]);
  };

  return {
    createArea: useMutation({
      mutationFn: (payload: CreateAreaPayload) => createArea(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('Area saved');
      },
    }),
    updateArea: useMutation({
      mutationFn: ({ areaId, payload }: { areaId: string; payload: UpdateAreaPayload }) => updateArea(requiredTenant(activeTenantId), areaId, payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('Area updated');
      },
    }),
    archiveArea: useMutation({
      mutationFn: (areaId: string) => archiveArea(requiredTenant(activeTenantId), areaId),
      onSuccess: async () => {
        await invalidate();
        toast.success('Area archived');
      },
    }),
    createHouse: useMutation({
      mutationFn: (payload: CreateHousePayload) => createHouse(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('House saved');
      },
    }),
    updateHouse: useMutation({
      mutationFn: ({ houseId, payload }: { houseId: string; payload: UpdateHousePayload }) => updateHouse(requiredTenant(activeTenantId), houseId, payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('House updated');
      },
    }),
    archiveHouse: useMutation({
      mutationFn: (houseId: string) => archiveHouse(requiredTenant(activeTenantId), houseId),
      onSuccess: async () => {
        await invalidate();
        toast.success('House archived');
      },
    }),
    createResident: useMutation({
      mutationFn: (payload: CreateResidentPayload) => createResident(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('Resident saved');
      },
    }),
    updateResident: useMutation({
      mutationFn: ({ residentId, payload }: { residentId: string; payload: UpdateResidentPayload }) => updateResident(requiredTenant(activeTenantId), residentId, payload),
      onSuccess: async () => {
        await invalidate();
        toast.success('Resident updated');
      },
    }),
    moveResidentHouse: useMutation({
      mutationFn: ({ residentId, houseId }: { residentId: string; houseId: string }) => moveResidentHouse(requiredTenant(activeTenantId), residentId, houseId),
      onSuccess: async () => {
        await invalidate();
        toast.success('House assignment updated');
      },
    }),
    archiveResident: useMutation({
      mutationFn: (residentId: string) => archiveResident(requiredTenant(activeTenantId), residentId),
      onSuccess: async () => {
        await invalidate();
        toast.success('Resident archived');
      },
    }),
    reactivateResident: useMutation({
      mutationFn: (residentId: string) => reactivateResident(requiredTenant(activeTenantId), residentId),
      onSuccess: async () => {
        await invalidate();
        toast.success('Resident reactivated');
      },
    }),
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
    throw new Error('Record id is required.');
  }
  return id;
}
