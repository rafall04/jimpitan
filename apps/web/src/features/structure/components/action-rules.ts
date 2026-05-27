/**
 * Purpose: Pure RBAC/action visibility helpers for Residents/Houses/Areas UI controls.
 * Caller: Structure pages and unit tests.
 * Deps: Structure status types.
 * MainFuncs: Computes visible actions without rendering or duplicating backend authorization.
 * SideEffects: None.
 */
import type { AreaRecord, HouseRecord, ResidentListRow } from '../types';

export type StructureAction = 'create' | 'edit' | 'archive' | 'reactivate' | 'assign-house';

export function canUsePermission(permissions: ReadonlySet<string>, permission: string): boolean {
  return permissions.has(permission);
}

export function getResidentActions(resident: ResidentListRow, permissions: ReadonlySet<string>): StructureAction[] {
  const actions: StructureAction[] = [];
  if (resident.status === 'ACTIVE' && canUsePermission(permissions, 'residents.update')) {
    actions.push('edit', 'assign-house');
  }
  if (resident.status !== 'ACTIVE' && canUsePermission(permissions, 'residents.update')) {
    actions.push('reactivate');
  }
  if (resident.status === 'ACTIVE' && canUsePermission(permissions, 'residents.delete')) {
    actions.push('archive');
  }
  return actions;
}

export function getHouseActions(house: HouseRecord, permissions: ReadonlySet<string>): StructureAction[] {
  if (!canUsePermission(permissions, 'houses.manage') || house.status === 'INACTIVE') {
    return [];
  }
  const actions: StructureAction[] = ['edit'];
  actions.push('archive');
  return actions;
}

export function getAreaActions(area: AreaRecord, permissions: ReadonlySet<string>): StructureAction[] {
  if (!canUsePermission(permissions, 'areas.manage') || !area.isActive) {
    return [];
  }
  return ['edit', 'archive'];
}
