/**
 * Purpose: Lightweight client tabs (segmented control) without extra dependencies.
 * Caller: Feature pages that switch between views.
 * Deps: React state, cn utility.
 * MainFuncs: Renders a tablist + active panel from an items array.
 * SideEffects: None (local UI state only).
 */
'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type TabItem = { value: string; label: ReactNode; content: ReactNode };

export function Tabs({ items, defaultValue, className }: { items: TabItem[]; defaultValue?: string; className?: string }) {
  const [active, setActive] = useState(defaultValue ?? items[0]?.value);
  const current = items.find((item) => item.value === active) ?? items[0];

  return (
    <div className={className}>
      <div role="tablist" className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={item.value === active}
            onClick={() => setActive(item.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              item.value === active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4">
        {current?.content}
      </div>
    </div>
  );
}
