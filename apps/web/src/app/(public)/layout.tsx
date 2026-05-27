/**
 * Purpose: Public route-group layout for unauthenticated pages.
 * Caller: Next.js App Router public routes.
 * Deps: PublicShell component.
 * MainFuncs: Separates public pages from authenticated dashboard routes.
 * SideEffects: None.
 */
import type { ReactNode } from 'react';
import { PublicShell } from '@/components/app-shell/public-shell';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
