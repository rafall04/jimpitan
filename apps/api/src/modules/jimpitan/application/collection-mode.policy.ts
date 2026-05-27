/**
 * Purpose: Policy boundary for mode-specific Jimpitan validation and submission rules.
 * Caller: JimpitanService and PrismaJimpitanRepository.
 * Deps: Nest BadRequestException and collection mode domain contracts.
 * MainFuncs: Validates PER_HOUSE item requirements, BULK_TOTAL positive integer totals, and HYBRID foundation readiness.
 * SideEffects: Throws request validation exceptions.
 */
import { BadRequestException } from '@nestjs/common';
import type { CollectionMode } from '../domain/collection-mode.types';
import { collectionModeContract } from '../domain/collection-mode.types';

export type CollectionModeSubmissionInput = {
  collectionId: string;
  collectionMode: CollectionMode;
  totalAmount: string;
  itemCount: number;
};

export type BulkTotalAmountInput = {
  collectionMode?: CollectionMode;
  totalAmount: string;
};

export function assertCollectionModeSubmissionReady(input: CollectionModeSubmissionInput): void {
  const contract = collectionModeContract(input.collectionMode);
  if (contract.requiresHouseItems && input.itemCount <= 0) {
    throw new BadRequestException('PER_HOUSE collections must contain at least one house item before submission or validation.');
  }
  if (contract.requiresPositiveTotalAmount) {
    assertBulkTotalAmount(input);
  }
}

export function assertBulkTotalAmount(input: BulkTotalAmountInput): void {
  if (!/^[1-9]\d{0,11}$/.test(input.totalAmount)) {
    throw new BadRequestException('BULK_TOTAL collections require a positive integer currency total.');
  }
}

export function assertPerHouseItemsAllowed(collectionMode: CollectionMode): void {
  if (!collectionModeContract(collectionMode).requiresHouseItems) {
    throw new BadRequestException('BULK_TOTAL collections do not use per-house collection items.');
  }
}
