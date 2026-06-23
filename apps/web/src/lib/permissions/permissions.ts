/**
 * Purpose: Frontend permission key definitions and access helpers.
 * Caller: Navigation, route guards, and placeholder shell components.
 * Deps: None.
 * MainFuncs: Defines known permission keys and evaluates any-of permission checks for route and action gates.
 * SideEffects: None.
 */
export const PERMISSION_KEYS = [
  'residents.read',
  'residents.create',
  'residents.update',
  'residents.delete',
  'houses.read',
  'houses.manage',
  'areas.read',
  'areas.manage',
  'collections.read',
  'collections.create',
  'collections.update_own',
  'collections.submit_own',
  'collections.validate',
  'collections.reject',
  'transactions.read',
  'transactions.create',
  'transactions.update',
  'transactions.delete',
  'transactions.validate',
  'transactions.post',
  'approvals.read',
  'approvals.decide',
  'reports.private.read',
  'settings.read',
  'settings.update',
  'notifications.read',
  'content.read',
  'content.create',
  'content.update',
  'content.publish',
  'content.delete',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number] | string;

export function hasAnyPermission(permissions: ReadonlySet<string>, required: readonly PermissionKey[]): boolean {
  if (required.length === 0) {
    return true;
  }
  return required.some((permission) => permissions.has(permission));
}
