/**
 * Purpose: Public application shell for unauthenticated transparency routes.
 * Caller: Public App Router layout.
 * Deps: next/link, ReactNode, and Button component.
 * MainFuncs: Provides public transparency navigation, content region, and footer boundary.
 * SideEffects: None.
 */
import Link from 'next/link';
import React from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Link href="/" className="shrink-0 text-base font-semibold tracking-normal">
            JIMPITAN RT
          </Link>
          <nav aria-label="Navigasi publik" className="flex max-w-full items-center gap-1 overflow-x-auto">
            <Button variant="ghost" className="px-3" asChild>
              <Link href="/reports">Laporan</Link>
            </Button>
            <Button variant="ghost" className="px-3" asChild>
              <Link href="/reports/monthly">Bulanan</Link>
            </Button>
            <Button variant="ghost" className="px-3" asChild>
              <Link href="/announcements">Pengumuman</Link>
            </Button>
            <Button variant="outline" className="px-3" asChild>
              <Link href="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t py-6">
        <div className="mx-auto w-full max-w-6xl px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">Transparansi publik JIMPITAN RT.</div>
      </footer>
    </div>
  );
}
