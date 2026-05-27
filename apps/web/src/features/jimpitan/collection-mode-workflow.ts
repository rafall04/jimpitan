/**
 * Purpose: Frontend boundary for mode-specific Jimpitan workflows.
 * Caller: Session detail, mobile collection, validation, finance posting, and report UI mode switches.
 * Deps: Jimpitan contract types.
 * MainFuncs: Selects PER_HOUSE checklist and BULK_TOTAL total-only UI behavior and validates bulk total input.
 * SideEffects: None.
 */
import type { CollectionMode, CollectionSessionRecord } from './types';

export type CollectionModeWorkflow = {
  mode: CollectionMode;
  showsHouseChecklist: boolean;
  showsBulkTotalInput: boolean;
  showsOutstandingHouses: boolean;
};

export function getCollectionModeWorkflow(collection: Pick<CollectionSessionRecord, 'collectionMode'>): CollectionModeWorkflow {
  if (collection.collectionMode === 'BULK_TOTAL') {
    return {
      mode: collection.collectionMode,
      showsHouseChecklist: false,
      showsBulkTotalInput: true,
      showsOutstandingHouses: false,
    };
  }
  return {
    mode: collection.collectionMode,
    showsHouseChecklist: true,
    showsBulkTotalInput: false,
    showsOutstandingHouses: true,
  };
}

export function assertBulkTotalInputReady(input: { totalAmount: string }): void {
  if (!/^[1-9]\d{0,11}$/.test(input.totalAmount.trim())) {
    throw new Error('Bulk total must be a positive whole-rupiah amount.');
  }
}
