/**
 * Purpose: Desktop dashboard sidebar navigation.
 * Caller: DashboardShell.
 * Deps: Next Link, lucide-react icons, navigation metadata, and cn utility.
 * MainFuncs: Renders permission-filtered private navigation with active route state.
 * SideEffects: None.
 */
import Link from 'next/link';
import { BadgeCheck, FileText, HandCoins, Home, LayoutDashboard, MapPinned, Newspaper, Settings, Users, WalletCards, type LucideIcon } from 'lucide-react';
import type { DashboardNavItem, ResolvedDashboardNavItem } from '@/lib/navigation/navigation';
import { cn } from '@/lib/utils/cn';

const ICONS: Record<DashboardNavItem['icon'], LucideIcon> = {
  LayoutDashboard,
  Users,
  Home,
  MapPinned,
  HandCoins,
  WalletCards,
  BadgeCheck,
  FileText,
  Newspaper,
  Settings,
};

function groupItems(items: ResolvedDashboardNavItem[]): Array<{ section?: string; items: ResolvedDashboardNavItem[] }> {
  const groups: Array<{ section?: string; items: ResolvedDashboardNavItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}

export function DashboardSidebar({ items, pathname }: { items: ResolvedDashboardNavItem[]; pathname: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card md:flex md:flex-col" aria-label="Dashboard navigation">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/dashboard" className="text-lg font-extrabold tracking-tight">
          RT<span className="text-primary">ku</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Primary">
        {groupItems(items).map((group, index) => (
          <div key={group.section ?? `group-${index}`} className="space-y-1">
            {group.section ? <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{group.section}</p> : null}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const isActive = pathname === item.href.split('?')[0];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive && 'bg-accent text-accent-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
