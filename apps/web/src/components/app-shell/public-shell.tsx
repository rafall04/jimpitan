/**
 * Purpose: Public application shell for unauthenticated transparency routes.
 * Caller: Public App Router layout.
 * Deps: next/link, lucide Home icon, Button, ThemeToggle.
 * MainFuncs: Sticky app-like header (clear home link + theme toggle + login) with a scrollable
 *   section nav, plus content region and footer boundary.
 * SideEffects: None.
 */
import Link from 'next/link';
import { Home } from 'lucide-react';
import React from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/app-shell/theme-toggle';

const SECTIONS: { href: string; label: string }[] = [
  { href: '/', label: 'Beranda' },
  { href: '/reports', label: 'Laporan' },
  { href: '/reports/monthly', label: 'Bulanan' },
  { href: '/kegiatan', label: 'Kegiatan' },
  { href: '/pengumuman', label: 'Pengumuman' },
  { href: '/galeri', label: 'Galeri' },
];

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="Kembali ke beranda"
              className="flex shrink-0 items-center gap-2 rounded-lg py-1 text-lg font-extrabold tracking-tight transition-colors hover:text-primary"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Home className="h-5 w-5" aria-hidden="true" />
              </span>
              RT<span className="text-primary">ku</span>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="outline" className="px-3" asChild>
                <Link href="/login">Masuk</Link>
              </Button>
            </div>
          </div>
          <nav
            aria-label="Navigasi publik"
            className="flex items-center gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SECTIONS.map((section) => (
              <Button key={section.href} variant="ghost" size="sm" className="shrink-0 px-3" asChild>
                <Link href={section.href}>{section.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t py-6">
        <div className="mx-auto w-full max-w-6xl px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">Transparansi publik RTku — kas, kegiatan, dan kabar warga.</div>
      </footer>
    </div>
  );
}
