/**
 * Purpose: Illustrated empty-state foundation for lists and detail panels.
 * Caller: DataTable, feature list/detail pages, and public report sections.
 * Deps: React, ReactNode, and a default lucide illustration.
 * MainFuncs: Presents an illustrated tile, title, description, and optional action slot accessibly.
 * SideEffects: None.
 */
import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import React from 'react';

export function EmptyState({ title, description, icon, children }: { title: string; description: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center" aria-live="polite">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
        {icon ?? <Inbox className="h-7 w-7" aria-hidden="true" />}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
