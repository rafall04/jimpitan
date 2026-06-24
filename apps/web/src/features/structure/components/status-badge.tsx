/**
 * Purpose: Compact status badge renderers for Residents/Houses/Areas records.
 * Caller: Structure tables, mobile cards, detail sheets, and tests.
 * Deps: Shared Badge component, structure status types.
 * MainFuncs: Converts backend status enums into accessible Indonesian visual labels.
 * SideEffects: None.
 */
import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { HouseStatus, ResidentStatus } from '../types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function StatusBadge({ label, variant }: { label: string; variant: BadgeVariant }) {
  return <Badge variant={variant}>{label}</Badge>;
}

const residentStatusLabels: Record<ResidentStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Diarsipkan',
  MOVED: 'Pindah',
};

const residentStatusVariants: Record<ResidentStatus, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'secondary',
  MOVED: 'gold',
};

export function ResidentStatusBadge({ status }: { status: ResidentStatus }) {
  return <StatusBadge label={residentStatusLabels[status]} variant={residentStatusVariants[status]} />;
}

const houseStatusLabels: Record<HouseStatus, string> = {
  EMPTY: 'Kosong',
  OCCUPIED: 'Terisi',
  INACTIVE: 'Diarsipkan',
};

const houseStatusVariants: Record<HouseStatus, BadgeVariant> = {
  EMPTY: 'secondary',
  OCCUPIED: 'success',
  INACTIVE: 'destructive',
};

export function HouseStatusBadge({ status }: { status: HouseStatus }) {
  return <StatusBadge label={houseStatusLabels[status]} variant={houseStatusVariants[status]} />;
}

export function AreaStatusBadge({ isActive }: { isActive: boolean }) {
  return <StatusBadge label={isActive ? 'Aktif' : 'Diarsipkan'} variant={isActive ? 'success' : 'secondary'} />;
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part[0]}${part.slice(1).toLowerCase()}`)
    .join(' ');
}
