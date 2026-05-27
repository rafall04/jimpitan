/**
 * Purpose: Global toast renderer foundation.
 * Caller: Root app providers.
 * Deps: sonner.
 * MainFuncs: Standardizes toast placement and color mode integration.
 * SideEffects: Renders a global toast portal.
 */
'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return <SonnerToaster richColors closeButton position="top-right" />;
}
