/**
 * Purpose: Shared RBAC domain types for permission evaluation boundaries.
 * Caller: Future guards, RBAC service, and controllers.
 * Deps: PermissionKey constants.
 * MainFuncs: Defines role, membership, and permission-check context plus typed route requirements.
 * SideEffects: None.
 */
import type { PermissionKey } from './permission.constants';

export type RoleKey = string;

export type PermissionCheckContext = {
  userId: string;
  rtId?: string;
  membershipId?: string;
  roles: RoleKey[];
  permissions: string[];
};

export type PermissionRequirement = {
  allOf?: PermissionKey[];
  anyOf?: PermissionKey[];
};
