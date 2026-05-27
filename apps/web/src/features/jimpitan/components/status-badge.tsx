/**
 * Purpose: Status badges and labels for Jimpitan sessions and collection items.
 * Caller: Jimpitan dashboard, session detail, and mobile flow.
 * Deps: React, class name utility, and Jimpitan status types.
 * MainFuncs: Converts backend enums into consistent operational labels and colors.
 * SideEffects: None.
 */
import React from 'react';
import { cn } from '@/lib/utils/cn';
import type { CollectionItemStatus, CollectionStatus } from '../types';

type Tone = 'neutral' | 'active' | 'submitted' | 'success' | 'danger' | 'warning';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  active: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  submitted: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
};

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  const tone: Record<CollectionStatus, Tone> = {
    DRAFT: 'neutral',
    IN_PROGRESS: 'active',
    SUBMITTED: 'submitted',
    VALIDATED: 'success',
    REJECTED: 'warning',
    CANCELLED: 'danger',
  };
  return <Badge label={formatStatus(status)} tone={tone[status]} />;
}

export function ItemStatusBadge({ status }: { status: CollectionItemStatus | 'NO_INPUT' }) {
  const tone: Record<CollectionItemStatus | 'NO_INPUT', Tone> = {
    PAID: 'success',
    UNPAID: 'warning',
    HOUSE_EMPTY: 'neutral',
    TITIP_TETANGGA: 'active',
    MENUNGGAK: 'danger',
    DISPENSATION: 'submitted',
    NO_INPUT: 'neutral',
  };
  return <Badge label={formatStatus(status)} tone={tone[status]} />;
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part[0]}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={cn('inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium', toneClasses[tone])}>{label}</span>;
}
