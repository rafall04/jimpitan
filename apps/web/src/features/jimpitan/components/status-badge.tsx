/**
 * Purpose: Status badges and labels for Jimpitan sessions and collection items.
 * Caller: Jimpitan dashboard, session detail, and mobile flow.
 * Deps: React, shared Badge primitive, and Jimpitan status types.
 * MainFuncs: Converts backend enums into consistent Indonesian operational labels and colors.
 * SideEffects: None.
 */
import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { CollectionItemStatus, CollectionMode, CollectionStatus } from '../types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const collectionStatusLabels: Record<CollectionStatus, string> = {
  DRAFT: 'Draf',
  IN_PROGRESS: 'Berlangsung',
  SUBMITTED: 'Diajukan',
  VALIDATED: 'Tervalidasi',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

const itemStatusLabels: Record<CollectionItemStatus | 'NO_INPUT', string> = {
  PAID: 'Sudah disetor',
  UNPAID: 'Belum disetor',
  HOUSE_EMPTY: 'Rumah kosong',
  TITIP_TETANGGA: 'Titip tetangga',
  MENUNGGAK: 'Menunggak',
  DISPENSATION: 'Dispensasi',
  NO_INPUT: 'Belum diisi',
};

export function CollectionStatusBadge({ status }: { status: CollectionStatus }) {
  const variant: Record<CollectionStatus, BadgeVariant> = {
    DRAFT: 'secondary',
    IN_PROGRESS: 'gold',
    SUBMITTED: 'default',
    VALIDATED: 'success',
    REJECTED: 'destructive',
    CANCELLED: 'destructive',
  };
  return <Badge variant={variant[status]}>{formatCollectionStatus(status)}</Badge>;
}

export function ItemStatusBadge({ status }: { status: CollectionItemStatus | 'NO_INPUT' }) {
  const variant: Record<CollectionItemStatus | 'NO_INPUT', BadgeVariant> = {
    PAID: 'success',
    UNPAID: 'gold',
    HOUSE_EMPTY: 'secondary',
    TITIP_TETANGGA: 'default',
    MENUNGGAK: 'destructive',
    DISPENSATION: 'outline',
    NO_INPUT: 'outline',
  };
  return <Badge variant={variant[status]}>{formatItemStatus(status)}</Badge>;
}

export function formatCollectionStatus(status: CollectionStatus): string {
  return collectionStatusLabels[status] ?? formatStatus(status);
}

export function formatItemStatus(status: CollectionItemStatus | 'NO_INPUT'): string {
  return itemStatusLabels[status] ?? formatStatus(status);
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part[0]}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

const collectionModeLabels: Record<CollectionMode, string> = {
  PER_HOUSE: 'Per rumah',
  BULK_TOTAL: 'Total langsung',
  HYBRID: 'Campuran',
};

export function formatCollectionModeLabel(mode: CollectionMode): string {
  return collectionModeLabels[mode] ?? formatStatus(mode);
}
