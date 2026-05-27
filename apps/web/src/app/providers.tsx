/**
 * Purpose: Root client provider composition for the frontend shell.
 * Caller: Root App Router layout.
 * Deps: next-themes, TanStack Query provider, and toast provider.
 * MainFuncs: Wires theme, query cache, and global toasts across route groups.
 * SideEffects: Owns browser-side provider state.
 */
'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/feedback/toaster';
import { AppQueryProvider } from '@/lib/query/query-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AppQueryProvider>
        {children}
        <Toaster />
      </AppQueryProvider>
    </ThemeProvider>
  );
}
