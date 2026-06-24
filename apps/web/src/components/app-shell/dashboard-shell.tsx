/**
 * Purpose: Authenticated dashboard shell composition.
 * Caller: Dashboard App Router layout.
 * Deps: TenantProvider, navigation registry, sidebar, mobile nav, and topbar.
 * MainFuncs: Provides tenant-aware responsive private app chrome.
 * SideEffects: Owns client-side tenant selection state through TenantProvider.
 */
'use client';

import { useMemo, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LoadingState } from '@/components/feedback/loading-state';
import { AuthErrorPanel } from '@/features/auth/auth-error-panel';
import type { SessionSnapshot } from '@/features/auth/session-types';
import { useSessionQuery } from '@/features/auth/use-session';
import { TenantProvider, useTenantContext } from '@/features/tenants/tenant-provider';
import { DASHBOARD_NAV_ITEMS, getAllowedNavigationItems, isRouteAllowed, type ResolvedDashboardNavItem } from '@/lib/navigation/navigation';
import { CommandPalette } from './command-palette';
import { DashboardSidebar } from './dashboard-sidebar';
import { MobileBottomNav } from './mobile-bottom-nav';
import { MobileNav } from './mobile-nav';
import { Topbar } from './topbar';

export function DashboardShell({ session, children }: { session: SessionSnapshot | null; children: ReactNode }) {
  const sessionQuery = useSessionQuery();

  if (sessionQuery.isPending) {
    return <LoadingState label="Loading session" />;
  }

  if (sessionQuery.isError || !sessionQuery.data?.session) {
    return <AuthErrorPanel />;
  }

  return (
    <TenantProvider session={sessionQuery.data.session ?? session}>
      <DashboardShellContent>{children}</DashboardShellContent>
    </TenantProvider>
  );
}

function DashboardShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { permissions, activeTenantId } = useTenantContext();
  const navItems = useMemo<ResolvedDashboardNavItem[]>(() => {
    const overview: ResolvedDashboardNavItem = { ...DASHBOARD_NAV_ITEMS[0], href: '/dashboard' };
    return [overview, ...getAllowedNavigationItems(permissions, activeTenantId)];
  }, [activeTenantId, permissions]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar items={navItems} pathname={pathname} />
      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar>
          <MobileNav items={navItems} pathname={pathname} />
        </Topbar>
        <div className="flex-1 pb-16 md:pb-0">{isRouteAllowed(pathname, permissions) ? children : <ForbiddenPanel />}</div>
      </div>
      <MobileBottomNav items={navItems} pathname={pathname} />
      <CommandPalette items={navItems} />
    </div>
  );
}

function ForbiddenPanel() {
  return (
    <main id="main-content" className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm" role="alert">
        <h1 className="text-xl font-semibold">Access not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your active RT role does not include access to this page.</p>
      </section>
    </main>
  );
}
