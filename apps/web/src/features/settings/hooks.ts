/**
 * Purpose: TanStack Query hooks for tenant-scoped settings (finance visibility).
 * Caller: Settings page + finance visibility card.
 * Deps: TanStack Query, sonner, tenant context, settings API adapter.
 * MainFuncs: Loads + mutates the kas visibility/token and invalidates the scoped cache.
 * SideEffects: API calls, cache updates, toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/api-error';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { getFinanceVisibility, regenerateFinanceToken, setFinanceVisibility } from './api';
import type { FinanceVisibilityMode } from './types';

function visibilityKey(rtId: string) {
  return ['rt', rtId, 'settings', 'finance-visibility'] as const;
}

export function useFinanceVisibilityQuery() {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? visibilityKey(activeTenantId) : ['settings', 'disabled'],
    queryFn: () => getFinanceVisibility(requiredTenant(activeTenantId)),
    enabled: Boolean(activeTenantId),
  });
}

export function useFinanceVisibilityMutations() {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: visibilityKey(requiredTenant(activeTenantId)) });
  };

  return {
    setMode: useMutation({
      mutationFn: (mode: FinanceVisibilityMode) => setFinanceVisibility(requiredTenant(activeTenantId), mode),
      onSuccess: async () => {
        await invalidate();
        toast.success('Visibilitas kas diperbarui');
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Gagal menyimpan.'),
    }),
    regenerate: useMutation({
      mutationFn: () => regenerateFinanceToken(requiredTenant(activeTenantId)),
      onSuccess: async () => {
        await invalidate();
        toast.success('Token akses baru dibuat');
      },
      onError: (error) => toast.error(error instanceof ApiError ? error.message : 'Gagal membuat token.'),
    }),
  };
}

function requiredTenant(activeTenantId: string | undefined): string {
  if (!activeTenantId) {
    throw new Error('RT aktif diperlukan.');
  }
  return activeTenantId;
}
