/**
 * Purpose: Authenticated dashboard route-group layout.
 * Caller: Next.js App Router dashboard routes.
 * Deps: Server session snapshot reader and DashboardShell.
 * MainFuncs: Reads non-sensitive session metadata and composes tenant-aware shell.
 * SideEffects: Reads cookies server-side.
 */
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/app-shell/dashboard-shell';
import { readSessionSnapshot } from '@/features/auth/session.server';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await readSessionSnapshot();
  if (!session) {
    redirect('/login');
  }

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
