/**
 * Purpose: Unit tests for structure action visibility and RBAC helper logic.
 * Caller: Vitest test runner.
 * Deps: Pure action-rule helpers and structure fixture shapes.
 * MainFuncs: Verifies hidden buttons for missing permissions and lifecycle-sensitive actions.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { getAreaActions, getHouseActions, getResidentActions } from './action-rules';
import type { AreaRecord, HouseRecord, ResidentListRow } from '../types';

describe('structure action rules', () => {
  it('hides resident mutations without RBAC permissions', () => {
    expect(getResidentActions(residentFixture({ status: 'ACTIVE' }), new Set())).toEqual([]);
  });

  it('shows archive for active residents and reactivate for archived residents', () => {
    const permissions = new Set(['residents.update', 'residents.delete']);

    expect(getResidentActions(residentFixture({ status: 'ACTIVE' }), permissions)).toEqual(['edit', 'assign-house', 'archive']);
    expect(getResidentActions(residentFixture({ status: 'INACTIVE' }), permissions)).toEqual(['reactivate']);
  });

  it('keeps house and area edit/archive actions lifecycle-aware', () => {
    const permissions = new Set(['houses.manage', 'areas.manage']);

    expect(getHouseActions(houseFixture({ status: 'EMPTY' }), permissions)).toEqual(['edit', 'archive']);
    expect(getHouseActions(houseFixture({ status: 'INACTIVE' }), permissions)).toEqual([]);
    expect(getAreaActions(areaFixture({ isActive: true }), permissions)).toEqual(['edit', 'archive']);
    expect(getAreaActions(areaFixture({ isActive: false }), permissions)).toEqual([]);
  });
});

function areaFixture(input: Partial<AreaRecord>): AreaRecord {
  return {
    id: 'area-1',
    rtId: 'rt-1',
    code: 'A',
    name: 'Area A',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...input,
  };
}

function houseFixture(input: Partial<HouseRecord>): HouseRecord {
  return {
    id: 'house-1',
    rtId: 'rt-1',
    areaId: 'area-1',
    houseNumber: 'A-01',
    addressNote: null,
    status: 'EMPTY',
    area: { id: 'area-1', code: 'A', name: 'Area A', sortOrder: 1 },
    activeResidentCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...input,
  };
}

function residentFixture(input: Partial<ResidentListRow>): ResidentListRow {
  return {
    id: 'resident-1',
    rtId: 'rt-1',
    houseId: 'house-1',
    fullName: 'Budi',
    phone: null,
    status: 'ACTIVE',
    defaultJimpitanAmount: '0',
    telegramAccountId: null,
    house: { id: 'house-1', houseNumber: 'A-01', status: 'OCCUPIED', area: { id: 'area-1', code: 'A', name: 'Area A', sortOrder: 1 } },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...input,
  };
}
