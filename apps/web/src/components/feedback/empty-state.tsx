/**
 * Purpose: Generic empty state foundation.
 * Caller: Placeholder pages and future feature lists.
 * Deps: React and ReactNode.
 * MainFuncs: Presents title, description, and optional action slot accessibly.
 * SideEffects: None.
 */
import type { ReactNode } from 'react';
import React from 'react';

export function EmptyState({ title, description, icon, children }: { title: string; description: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center justify-center rounded-xl border bg-card p-8 text-center shadow-sm" aria-live="polite">
      {icon ? <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div> : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
