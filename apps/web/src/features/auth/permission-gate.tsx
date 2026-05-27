/**
 * Purpose: Permission-aware UI helper for private dashboard components.
 * Caller: Navigation-adjacent UI and future feature action controls.
 * Deps: Tenant context and permission helper.
 * MainFuncs: Renders children only when the active tenant has any required permission.
 * SideEffects: None.
 */
'use client';

import type { ReactNode } from 'react';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { hasAnyPermission, type PermissionKey } from '@/lib/permissions/permissions';

export function PermissionGate({
  anyOf,
  children,
  fallback = null,
}: {
  anyOf: PermissionKey[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { permissions } = useTenantContext();
  return hasAnyPermission(permissions, anyOf) ? <>{children}</> : <>{fallback}</>;
}

export function useCan(anyOf: PermissionKey[]): boolean {
  const { permissions } = useTenantContext();
  return hasAnyPermission(permissions, anyOf);
}
