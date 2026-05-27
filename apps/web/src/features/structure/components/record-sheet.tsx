/**
 * Purpose: Shared side-sheet layout and detail primitives for structure records.
 * Caller: Residents, Houses, and Areas pages.
 * Deps: Sheet UI primitive and ReactNode.
 * MainFuncs: Provides consistent mobile-friendly drawers and key/value detail rows.
 * SideEffects: Opens a client-side sheet through Radix Dialog.
 */
'use client';

import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export function RecordSheet({
  open,
  title,
  description,
  children,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="divide-y rounded-lg border bg-card text-sm">{children}</dl>;
}

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || <span className="text-muted-foreground">None</span>}</dd>
    </div>
  );
}
