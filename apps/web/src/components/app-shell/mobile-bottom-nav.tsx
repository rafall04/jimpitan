/**
 * Purpose: App-like bottom tab bar for the dashboard on small screens.
 * Caller: DashboardShell (mobile only).
 * Deps: Next Link, lucide icons, navigation metadata, cn utility.
 * MainFuncs: Renders the top permission-filtered nav items as bottom tabs with active state.
 * SideEffects: None.
 */
'use client';

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

export function MobileBottomNav({ items, pathname }: { items: ResolvedDashboardNavItem[]; pathname: string }) {
  const priority = ['/dashboard', '/dashboard/finance', '/dashboard/content', '/dashboard/jimpitan', '/dashboard/residents', '/dashboard/approvals'];
  const byHref = new Map(items.map((item) => [item.href.split('?')[0], item]));
  const tabs = priority.map((href) => byHref.get(href)).filter((item): item is ResolvedDashboardNavItem => Boolean(item)).slice(0, 5);
  if (tabs.length === 0) {
    return null;
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden" aria-label="Navigasi bawah">
      {tabs.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href.split('?')[0];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn('flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon className={cn('h-5 w-5', active && 'scale-110')} aria-hidden="true" />
            <span className="max-w-full truncate px-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
