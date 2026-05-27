/**
 * Purpose: Generic safe error state foundation.
 * Caller: App error boundaries and future query error surfaces.
 * Deps: React and Button component.
 * MainFuncs: Shows non-sensitive error copy and optional retry action.
 * SideEffects: Invokes caller-provided action when requested.
 */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

export function ErrorState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm" role="alert">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {actionLabel && onAction ? (
          <Button className="mt-5" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </section>
    </main>
  );
}
