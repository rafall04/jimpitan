/**
 * Purpose: Collection mode contract for Jimpitan session behavior.
 * Caller: Jimpitan DTOs, command contracts, service policies, finance posting, reports, Telegram flow, and frontend mirrors.
 * Deps: None.
 * MainFuncs: Defines supported collection modes and mode-specific contract metadata without persistence logic.
 * SideEffects: None.
 */
export const COLLECTION_MODES = ['PER_HOUSE', 'BULK_TOTAL', 'HYBRID'] as const;
export const DEFAULT_COLLECTION_MODE: CollectionMode = 'PER_HOUSE';

export type CollectionMode = (typeof COLLECTION_MODES)[number];

export type CollectionModeContract = {
  mode: CollectionMode;
  requiresHouseItems: boolean;
  requiresPositiveTotalAmount: boolean;
  tracksOutstandingPerHouse: boolean;
};

export const COLLECTION_MODE_CONTRACTS: Record<CollectionMode, CollectionModeContract> = {
  PER_HOUSE: {
    mode: 'PER_HOUSE',
    requiresHouseItems: true,
    requiresPositiveTotalAmount: false,
    tracksOutstandingPerHouse: true,
  },
  BULK_TOTAL: {
    mode: 'BULK_TOTAL',
    requiresHouseItems: false,
    requiresPositiveTotalAmount: true,
    tracksOutstandingPerHouse: false,
  },
  HYBRID: {
    mode: 'HYBRID',
    requiresHouseItems: true,
    requiresPositiveTotalAmount: true,
    tracksOutstandingPerHouse: true,
  },
};

export function isCollectionMode(value: unknown): value is CollectionMode {
  return typeof value === 'string' && (COLLECTION_MODES as readonly string[]).includes(value);
}

export function collectionModeContract(mode: CollectionMode): CollectionModeContract {
  return COLLECTION_MODE_CONTRACTS[mode];
}
