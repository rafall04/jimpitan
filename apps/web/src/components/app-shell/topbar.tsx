/**
 * Purpose: Dashboard topbar — brand/home, breadcrumb, RT switcher, theme, notifications, user menu.
 * Caller: DashboardShell.
 * Deps: Tenant context, breadcrumb, theme toggle, notification bell, user menu, ReactNode slot.
 * MainFuncs: Provides navigation context and account/theme affordances across dashboard pages.
 * SideEffects: Changes the active tenant selection when permitted.
 */
'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { NotificationBell } from '@/components/feedback/notification-bell';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { Breadcrumb } from './breadcrumb';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export function Topbar({ children }: { children: ReactNode }) {
  const { session, activeTenantId, hasMultipleTenants, canSelectTenant, setActiveTenantId } = useTenantContext();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {children}
      <Link href="/dashboard" className="text-lg font-extrabold tracking-tight md:hidden" aria-label="Ke ringkasan">
        RT<span className="text-primary">ku</span>
      </Link>
      <Breadcrumb />
      <div className="ml-auto flex items-center gap-1.5">
        {hasMultipleTenants ? (
          <>
            <label className="sr-only" htmlFor="tenant-switcher">Pilih RT</label>
            <select
              id="tenant-switcher"
              value={activeTenantId}
              onChange={(event) => {
                if (canSelectTenant(event.target.value)) {
                  setActiveTenantId(event.target.value);
                  return;
                }
                toast.error('Masuk dengan RT itu untuk berpindah konteks.');
              }}
              className="h-10 max-w-36 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {session?.tenants.map((tenant) => (
                <option key={tenant.rtId} value={tenant.rtId} disabled={!canSelectTenant(tenant.rtId)}>
                  {tenant.rtCode}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
