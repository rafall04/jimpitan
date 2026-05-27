/**
 * Purpose: Dashboard topbar with tenant context and notification affordance.
 * Caller: DashboardShell.
 * Deps: Tenant context, notification bell, and ReactNode slot.
 * MainFuncs: Renders mobile navigation slot, active RT selector, user metadata, and notification trigger.
 * SideEffects: Changes client-side active tenant selection when the tenant has a usable session context.
 */
'use client';

import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/feedback/notification-bell';
import { Button } from '@/components/ui/button';
import { useLogoutMutation } from '@/features/auth/use-session';
import { useTenantContext } from '@/features/tenants/tenant-provider';

export function Topbar({ children }: { children: ReactNode }) {
  const { session, activeTenant, activeTenantId, hasMultipleTenants, canSelectTenant, setActiveTenantId } = useTenantContext();
  const logoutMutation = useLogoutMutation();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {children}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{activeTenant?.rtName ?? 'No RT selected'}</p>
        <p className="truncate text-xs text-muted-foreground">{session?.user.name ?? 'Session unavailable'}</p>
      </div>
      {hasMultipleTenants ? (
        <label className="sr-only" htmlFor="tenant-switcher">
          Select RT
        </label>
      ) : null}
      {hasMultipleTenants ? (
        <select
          id="tenant-switcher"
          value={activeTenantId}
          onChange={(event) => {
            if (canSelectTenant(event.target.value)) {
              setActiveTenantId(event.target.value);
              return;
            }
            toast.error('Sign in with that RT to switch context.');
          }}
          className="h-10 max-w-36 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {session?.tenants.map((tenant) => (
            <option key={tenant.rtId} value={tenant.rtId} disabled={!canSelectTenant(tenant.rtId)}>
              {tenant.rtCode}
            </option>
          ))}
        </select>
      ) : null}
      <NotificationBell />
      <Button type="button" variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
        {logoutMutation.isPending ? 'Signing out' : 'Logout'}
      </Button>
    </header>
  );
}
