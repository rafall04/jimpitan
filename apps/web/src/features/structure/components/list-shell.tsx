/**
 * Purpose: Shared responsive shell pieces for structure list pages.
 * Caller: Residents, Houses, and Areas pages.
 * Deps: Button, Input, Skeleton, and class name utility.
 * MainFuncs: Renders page headers, filters, pagination controls, and loading skeletons consistently.
 * SideEffects: None.
 */
'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';

export function StructurePageHeader({
  title,
  description,
  eyebrow = 'Struktur RT',
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex shrink-0">{action}</div> : null}
    </div>
  );
}

export function SearchField({ value, label, placeholder, onChange }: { value: string; label: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${label}-search`}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id={`${label}-search`} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="pl-9" />
      </div>
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {children}
      </select>
    </div>
  );
}

export function PaginationControls({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Halaman {page} dari {Math.max(totalPages, 1)} - {total} data
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Sebelumnya
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

export function ListSkeleton({ label, rows = 6, variant = 'table' }: { label: string; rows?: number; variant?: 'table' | 'cards' | 'form' }) {
  if (variant === 'form') {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <span className="sr-only">{label}</span>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-10 w-24 rounded-md" />
          <Skeleton className="h-10 w-28 rounded-md" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-10 min-w-[12rem] flex-1" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="hidden h-10 w-36 sm:block" />
      </div>
      {variant === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="ml-auto h-3.5 w-16" />
          </div>
          <div className="divide-y">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
                <Skeleton className="ml-2 h-8 w-8 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
