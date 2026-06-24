/**
 * Purpose: Global command palette (Ctrl/Cmd+K) for fast dashboard navigation and quick actions.
 * Caller: DashboardShellContent.
 * Deps: Radix Dialog primitives, next/navigation router, next-themes, lucide icons, tenant context, navigation types.
 * MainFuncs: Opens via keyboard or custom event, filters nav + permission-gated actions, runs the active item.
 * SideEffects: Pushes routes, toggles the theme, listens to global keydown + 'rtku:command-open' events.
 */
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BadgeCheck,
  FileText,
  HandCoins,
  Home,
  LayoutDashboard,
  MapPinned,
  Moon,
  Newspaper,
  Plus,
  Receipt,
  Search,
  Settings,
  Sun,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTenantContext } from '@/features/tenants/tenant-provider';
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

type PaletteAction = {
  label: string;
  icon: LucideIcon;
  run: () => void;
};

export function CommandPalette({ items }: { items: ResolvedDashboardNavItem[] }) {
  const router = useRouter();
  const { permissions } = useTenantContext();
  const { resolvedTheme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onCommandOpen = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('rtku:command-open', onCommandOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('rtku:command-open', onCommandOpen);
    };
  }, []);

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    const can = (key: string) => permissions.has(key);
    if (can('content.create')) {
      list.push({ label: 'Buat konten', icon: Plus, run: () => router.push('/dashboard/content/new') });
    }
    if (can('transactions.create')) {
      list.push({ label: 'Catat transaksi', icon: Receipt, run: () => router.push('/dashboard/finance/transactions') });
    }
    if (can('residents.create')) {
      list.push({ label: 'Tambah warga', icon: Users, run: () => router.push('/dashboard/residents') });
    }
    if (can('collections.create')) {
      list.push({ label: 'Buat sesi jimpitan', icon: HandCoins, run: () => router.push('/dashboard/jimpitan/sessions') });
    }
    if (can('settings.read')) {
      list.push({ label: 'Buka pengaturan', icon: Settings, run: () => router.push('/dashboard/settings') });
    }
    const isDark = resolvedTheme === 'dark';
    list.push({
      label: 'Ganti tema gelap/terang',
      icon: isDark ? Sun : Moon,
      run: () => setTheme(isDark ? 'light' : 'dark'),
    });
    return list;
  }, [permissions, resolvedTheme, router, setTheme]);

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (label: string) => label.toLowerCase().includes(normalizedQuery);

  const filteredNav = useMemo(() => items.filter((item) => matchesQuery(item.label)), [items, normalizedQuery]);
  const filteredActions = useMemo(() => actions.filter((action) => matchesQuery(action.label)), [actions, normalizedQuery]);

  type FlatRow =
    | { kind: 'nav'; item: ResolvedDashboardNavItem }
    | { kind: 'action'; action: PaletteAction };

  const flatRows = useMemo<FlatRow[]>(
    () => [
      ...filteredNav.map((item) => ({ kind: 'nav' as const, item })),
      ...filteredActions.map((action) => ({ kind: 'action' as const, action })),
    ],
    [filteredNav, filteredActions],
  );

  const runRow = (row: FlatRow) => {
    if (row.kind === 'nav') {
      router.push(row.item.href);
    } else {
      row.action.run();
    }
    setOpen(false);
  };

  useEffect(() => {
    setActiveIndex((index) => {
      if (flatRows.length === 0) {
        return 0;
      }
      return Math.min(index, flatRows.length - 1);
    });
  }, [flatRows.length]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery('');
      setActiveIndex(0);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatRows.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flatRows.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flatRows.length) % flatRows.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = flatRows[activeIndex];
      if (row) {
        runRow(row);
      }
    }
  };

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const navOffset = 0;
  const actionOffset = filteredNav.length;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl focus:outline-none"
          onOpenAutoFocus={(event) => {
            // Let the search input own focus, not Radix's first focusable.
            event.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Palet perintah</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b px-3.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Cari halaman atau tindakan…"
              aria-label="Cari halaman atau tindakan"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">⌘K</kbd>
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
            {flatRows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada hasil</p>
            ) : (
              <>
                {filteredNav.length > 0 ? (
                  <div>
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Navigasi</p>
                    {filteredNav.map((item, index) => {
                      const Icon = ICONS[item.icon];
                      const rowIndex = navOffset + index;
                      const isActive = rowIndex === activeIndex;
                      return (
                        <button
                          key={item.href}
                          type="button"
                          data-active={isActive}
                          onMouseEnter={() => setActiveIndex(rowIndex)}
                          onClick={() => runRow({ kind: 'nav', item })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm cursor-pointer',
                            isActive && 'bg-accent text-accent-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {filteredActions.length > 0 ? (
                  <div>
                    <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tindakan cepat</p>
                    {filteredActions.map((action, index) => {
                      const Icon = action.icon;
                      const rowIndex = actionOffset + index;
                      const isActive = rowIndex === activeIndex;
                      return (
                        <button
                          key={action.label}
                          type="button"
                          data-active={isActive}
                          onMouseEnter={() => setActiveIndex(rowIndex)}
                          onClick={() => runRow({ kind: 'action', action })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm cursor-pointer',
                            isActive && 'bg-accent text-accent-foreground',
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
