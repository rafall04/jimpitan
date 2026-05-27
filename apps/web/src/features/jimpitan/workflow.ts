/**
 * Purpose: Pure Jimpitan workflow helpers for UI action visibility and mobile progression.
 * Caller: Jimpitan pages, mobile flow, and unit tests.
 * Deps: Jimpitan contract types.
 * MainFuncs: Computes lifecycle actions, mode labels, edit locks, progress percentage, and next-house navigation.
 * SideEffects: None.
 */
import type { CollectionChecklistHouse, CollectionSessionRecord } from './types';

export type CollectionAction = 'start' | 'generate-checklist' | 'submit' | 'validate' | 'reject' | 'cancel';

export function isEditableCollection(collection: CollectionSessionRecord): boolean {
  return collection.status === 'DRAFT' || collection.status === 'IN_PROGRESS' || collection.status === 'REJECTED';
}

export function getCollectionActions(collection: CollectionSessionRecord, permissions: ReadonlySet<string>, membershipId?: string): CollectionAction[] {
  const isOfficer = membershipId === collection.officerMembershipId;
  const canMutateOwn = permissions.has('collections.validate') || (isOfficer && permissions.has('collections.update_own'));
  const canSubmit = permissions.has('collections.validate') || (isOfficer && permissions.has('collections.submit_own'));
  const actions: CollectionAction[] = [];

  if ((collection.status === 'DRAFT' || collection.status === 'REJECTED') && canMutateOwn) {
    actions.push('start');
    if (collection.collectionMode !== 'BULK_TOTAL') {
      actions.push('generate-checklist');
    }
  }
  if (collection.status === 'IN_PROGRESS' && canMutateOwn && collection.collectionMode !== 'BULK_TOTAL') {
    actions.push('generate-checklist');
  }
  if ((collection.status === 'IN_PROGRESS' || collection.status === 'REJECTED') && canSubmit) {
    actions.push('submit');
  }
  if (collection.status === 'SUBMITTED' && permissions.has('collections.validate')) {
    actions.push('validate');
  }
  if (collection.status === 'SUBMITTED' && permissions.has('collections.reject')) {
    actions.push('reject');
  }
  if (collection.status !== 'VALIDATED' && collection.status !== 'CANCELLED' && (permissions.has('collections.reject') || permissions.has('collections.validate'))) {
    actions.push('cancel');
  }
  return actions;
}

export function getProgressPercent(input: { completedHouses: number; totalHouses: number }): number {
  if (input.totalHouses <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((input.completedHouses / input.totalHouses) * 100));
}

export function getNextHouseId(houses: CollectionChecklistHouse[], currentHouseId: string | null): string | null {
  if (houses.length === 0) {
    return null;
  }
  const startIndex = Math.max(0, currentHouseId ? houses.findIndex((house) => house.houseId === currentHouseId) + 1 : 0);
  const next = houses.slice(startIndex).find((house) => !house.item) ?? houses.find((house) => !house.item);
  return next?.houseId ?? houses[Math.min(startIndex, houses.length - 1)]?.houseId ?? null;
}

export function getCompletedCount(houses: CollectionChecklistHouse[]): number {
  return houses.filter((house) => Boolean(house.item)).length;
}

export function formatCurrencyAmount(value: string | number): string {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numberValue)) {
    return 'Rp0';
  }
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(numberValue);
}

export function formatCollectionMode(mode: CollectionSessionRecord['collectionMode']): string {
  if (mode === 'BULK_TOTAL') {
    return 'Bulk total';
  }
  if (mode === 'HYBRID') {
    return 'Hybrid';
  }
  return 'Per house';
}

export function isOutstandingStatus(status: string): boolean {
  return status === 'NO_INPUT' || status === 'UNPAID' || status === 'HOUSE_EMPTY' || status === 'TITIP_TETANGGA' || status === 'MENUNGGAK';
}
