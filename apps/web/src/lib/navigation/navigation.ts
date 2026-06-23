/**
 * Purpose: Permission-aware navigation registry for the dashboard shell.
 * Caller: Sidebar, mobile navigation, middleware-adjacent route helpers, and tests.
 * Deps: Permission helpers and lucide icon names by convention.
 * MainFuncs: Defines dashboard nav metadata, filters by permission, and resolves route access.
 * SideEffects: None.
 */
import type { PermissionKey } from '../permissions/permissions';
import { hasAnyPermission } from '../permissions/permissions';

export type DashboardNavItem = {
  label: string;
  href: `/dashboard${string}`;
  icon: 'LayoutDashboard' | 'Users' | 'Home' | 'MapPinned' | 'HandCoins' | 'WalletCards' | 'BadgeCheck' | 'FileText' | 'Newspaper' | 'Settings';
  permissions: PermissionKey[];
};

export type ResolvedDashboardNavItem = Omit<DashboardNavItem, 'href'> & {
  href: string;
};

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { label: 'Ringkasan', href: '/dashboard', icon: 'LayoutDashboard', permissions: [] },
  { label: 'Warga', href: '/dashboard/residents', icon: 'Users', permissions: ['residents.read'] },
  { label: 'Rumah', href: '/dashboard/houses', icon: 'Home', permissions: ['houses.read'] },
  { label: 'Area', href: '/dashboard/areas', icon: 'MapPinned', permissions: ['areas.read'] },
  { label: 'Jimpitan', href: '/dashboard/jimpitan', icon: 'HandCoins', permissions: ['collections.read', 'collections.update_own'] },
  { label: 'Keuangan', href: '/dashboard/finance', icon: 'WalletCards', permissions: ['transactions.read'] },
  { label: 'Persetujuan', href: '/dashboard/approvals', icon: 'BadgeCheck', permissions: ['approvals.read'] },
  { label: 'Konten', href: '/dashboard/content', icon: 'Newspaper', permissions: ['content.read'] },
  { label: 'Laporan', href: '/dashboard/reports', icon: 'FileText', permissions: ['reports.private.read'] },
  { label: 'Pengaturan', href: '/dashboard/settings', icon: 'Settings', permissions: ['settings.read'] },
];

export function getAllowedNavigationItems(permissions: ReadonlySet<string>, rtId?: string): ResolvedDashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.permissions.length > 0 && hasAnyPermission(permissions, item.permissions)).map((item) => ({
    ...item,
    href: withTenantParam(item.href, rtId),
  }));
}

export function isRouteAllowed(pathname: string, permissions: ReadonlySet<string>): boolean {
  if (!pathname.startsWith('/dashboard')) {
    return true;
  }
  const item = DASHBOARD_NAV_ITEMS.filter((candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`)).sort((left, right) => right.href.length - left.href.length)[0];
  return item ? hasAnyPermission(permissions, item.permissions) : false;
}

function withTenantParam(href: string, rtId?: string): string {
  if (!rtId || href === '/dashboard') {
    return href;
  }
  return `${href}?rtId=${encodeURIComponent(rtId)}`;
}
