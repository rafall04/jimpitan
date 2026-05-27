/**
 * Purpose: Unit tests for Jimpitan operational workflow rules.
 * Caller: Vitest test runner.
 * Deps: Pure workflow helpers and Jimpitan fixture shapes.
 * MainFuncs: Verifies lifecycle action visibility, duplicate-safe mobile queue behavior, and progress calculations.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { getCollectionModeWorkflow } from './collection-mode-workflow';
import { getCollectionActions, getNextHouseId, getProgressPercent, isEditableCollection } from './workflow';
import type { CollectionChecklistHouse, CollectionSessionRecord } from './types';

describe('jimpitan workflow helpers', () => {
  it('keeps lifecycle actions status and RBAC aware', () => {
    const officerPermissions = new Set(['collections.update_own', 'collections.submit_own']);
    const treasurerPermissions = new Set(['collections.validate', 'collections.reject']);

    expect(getCollectionActions(collectionFixture({ status: 'DRAFT' }), officerPermissions, 'membership-1')).toEqual(['start', 'generate-checklist']);
    expect(getCollectionActions(collectionFixture({ status: 'IN_PROGRESS' }), officerPermissions, 'membership-1')).toEqual(['generate-checklist', 'submit']);
    expect(getCollectionActions(collectionFixture({ status: 'SUBMITTED' }), treasurerPermissions, 'membership-2')).toEqual(['validate', 'reject', 'cancel']);
    expect(getCollectionActions(collectionFixture({ status: 'VALIDATED' }), treasurerPermissions, 'membership-2')).toEqual([]);
  });

  it('hides checklist generation for bulk total sessions and selects total-only workflow', () => {
    const officerPermissions = new Set(['collections.update_own', 'collections.submit_own']);
    const bulk = collectionFixture({ status: 'IN_PROGRESS', collectionMode: 'BULK_TOTAL', totalAmount: '75000' });

    expect(getCollectionActions(bulk, officerPermissions, 'membership-1')).toEqual(['submit']);
    expect(getCollectionModeWorkflow(bulk)).toEqual({
      mode: 'BULK_TOTAL',
      showsHouseChecklist: false,
      showsBulkTotalInput: true,
      showsOutstandingHouses: false,
    });
  });

  it('locks validated and submitted sessions for item editing', () => {
    expect(isEditableCollection(collectionFixture({ status: 'IN_PROGRESS' }))).toBe(true);
    expect(isEditableCollection(collectionFixture({ status: 'REJECTED' }))).toBe(true);
    expect(isEditableCollection(collectionFixture({ status: 'SUBMITTED' }))).toBe(false);
    expect(isEditableCollection(collectionFixture({ status: 'VALIDATED' }))).toBe(false);
  });

  it('finds the next unprocessed house for rapid mobile input', () => {
    const houses = [
      houseFixture({ houseId: 'house-1', item: { id: 'item-1', houseId: 'house-1', residentId: null, amount: '1000', status: 'PAID', note: null, updatedAt: new Date(0).toISOString() } }),
      houseFixture({ houseId: 'house-2', item: null }),
      houseFixture({ houseId: 'house-3', item: null }),
    ];

    expect(getNextHouseId(houses, 'house-1')).toBe('house-2');
    expect(getNextHouseId(houses, 'house-2')).toBe('house-3');
  });

  it('calculates progress defensively when total houses are zero', () => {
    expect(getProgressPercent({ completedHouses: 0, totalHouses: 0 })).toBe(0);
    expect(getProgressPercent({ completedHouses: 7, totalHouses: 10 })).toBe(70);
  });
});

function collectionFixture(input: Partial<CollectionSessionRecord>): CollectionSessionRecord {
  return {
    id: 'collection-1',
    rtId: 'rt-1',
    scheduleId: null,
    officerMembershipId: 'membership-1',
    collectionDate: new Date(0).toISOString(),
    collectionMode: 'PER_HOUSE',
    status: 'DRAFT',
    note: null,
    totalAmount: '0',
    submittedAt: null,
    validatedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    validationNote: null,
    rejectionReason: null,
    cancellationReason: null,
    updatedAt: new Date(0).toISOString(),
    officer: { membershipId: 'membership-1', userId: 'user-1', fullName: 'Officer' },
    route: { areaId: null, areaCode: null, areaName: null },
    itemCount: 0,
    ...input,
  };
}

function houseFixture(input: Partial<CollectionChecklistHouse>): CollectionChecklistHouse {
  return {
    houseId: 'house-1',
    houseNumber: 'A-01',
    area: { id: 'area-1', code: 'A', name: 'Area A' },
    primaryResident: { id: 'resident-1', fullName: 'Budi', defaultJimpitanAmount: '1000' },
    item: null,
    ...input,
  };
}
