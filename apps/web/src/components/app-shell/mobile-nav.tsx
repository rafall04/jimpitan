/**
 * Purpose: Mobile dashboard navigation sheet.
 * Caller: DashboardShell topbar.
 * Deps: Next Link, lucide-react icons, sheet primitives, navigation metadata, and cn utility.
 * MainFuncs: Provides permission-aware private navigation for small screens.
 * SideEffects: Opens and closes a client-side sheet.
 */
'use client';

import Link from 'next/link';
import { BadgeCheck, FileText, HandCoins, Home, LayoutDashboard, MapPinned, Menu, Newspaper, Settings, Users, WalletCards, type LucideIcon } from 'lucide-react';
import type { DashboardNavItem, ResolvedDashboardNavItem } from '@/lib/navigation/navigation';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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

export function MobileNav({ items, pathname }: { items: ResolvedDashboardNavItem[]; pathname: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle>JIMPITAN RT</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 space-y-1" aria-label="Mobile dashboard navigation">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const isActive = pathname === item.href.split('?')[0];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
