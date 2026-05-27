/**
 * Purpose: Authentication route-group layout.
 * Caller: Next.js App Router auth routes.
 * Deps: ReactNode.
 * MainFuncs: Provides a compact unauthenticated layout for login flows.
 * SideEffects: None.
 */
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center px-4 py-10">{children}</main>;
}
