/**
 * Purpose: Client tenant context for private dashboard routes.
 * Caller: DashboardShell and descendant feature shells.
 * Deps: React and non-sensitive session metadata types.
 * MainFuncs: Resolves active RT context, permissions, and tenant switching state.
 * SideEffects: Maintains client-side selected tenant state.
 */
'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SessionSnapshot, TenantMembershipSnapshot } from '@/features/auth/session-types';
import { isSelectableTenant, resolveActiveTenant, resolveInitialTenantId } from './tenant-selection';

export type TenantContextValue = {
  session: SessionSnapshot | null;
  activeTenant: TenantMembershipSnapshot | null;
  activeTenantId: string | undefined;
  permissions: ReadonlySet<string>;
  hasMultipleTenants: boolean;
  canSelectTenant: (rtId: string) => boolean;
  setActiveTenantId: (rtId: string) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ session, children }: { session: SessionSnapshot | null; children: ReactNode }) {
  const [activeTenantId, setActiveTenantId] = useState<string | undefined>(() => resolveInitialTenantId(session));
  const guardedSetActiveTenantId = (rtId: string) => {
    const tenant = session?.tenants.find((candidate) => candidate.rtId === rtId);
    if (tenant && isSelectableTenant(session, tenant)) {
      setActiveTenantId(rtId);
    }
  };

  const value = useMemo<TenantContextValue>(() => {
    const activeTenant = resolveActiveTenant(session, activeTenantId);
    const permissions = new Set(activeTenant?.permissions ?? []);

    return {
      session,
      activeTenant,
      activeTenantId: activeTenant?.rtId,
      permissions,
      hasMultipleTenants: Boolean(session && session.tenants.length > 1),
      canSelectTenant: (rtId: string) => {
        const tenant = session?.tenants.find((candidate) => candidate.rtId === rtId);
        return Boolean(tenant && isSelectableTenant(session, tenant));
      },
      setActiveTenantId: guardedSetActiveTenantId,
    };
  }, [activeTenantId, session]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) {
    throw new Error('useTenantContext must be used within TenantProvider.');
  }
  return value;
}
