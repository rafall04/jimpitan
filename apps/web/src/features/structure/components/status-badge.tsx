/**
 * Purpose: Compact status badge renderers for Residents/Houses/Areas records.
 * Caller: Structure tables, mobile cards, detail sheets, and tests.
 * Deps: Structure status types and class name utility.
 * MainFuncs: Converts backend status enums into accessible visual labels.
 * SideEffects: None.
 */
import { cn } from '@/lib/utils/cn';
import React from 'react';
import type { HouseStatus, ResidentStatus } from '../types';

type StatusTone = 'success' | 'warning' | 'muted' | 'danger';

const toneClasses: Record<StatusTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  muted: 'border-border bg-muted text-muted-foreground',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={cn('inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium', toneClasses[tone])}>{label}</span>;
}

export function ResidentStatusBadge({ status }: { status: ResidentStatus }) {
  const tone: Record<ResidentStatus, StatusTone> = {
    ACTIVE: 'success',
    INACTIVE: 'muted',
    MOVED: 'warning',
  };
  return <StatusBadge label={formatStatus(status)} tone={tone[status]} />;
}

export function HouseStatusBadge({ status }: { status: HouseStatus }) {
  const tone: Record<HouseStatus, StatusTone> = {
    EMPTY: 'muted',
    OCCUPIED: 'success',
    INACTIVE: 'danger',
  };
  return <StatusBadge label={formatStatus(status)} tone={tone[status]} />;
}

export function AreaStatusBadge({ isActive }: { isActive: boolean }) {
  return <StatusBadge label={isActive ? 'Active' : 'Archived'} tone={isActive ? 'success' : 'danger'} />;
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part[0]}${part.slice(1).toLowerCase()}`)
    .join(' ');
}
