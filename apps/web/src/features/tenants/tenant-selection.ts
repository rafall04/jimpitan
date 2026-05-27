/**
 * Purpose: Pure tenant selection helpers for the dashboard tenant context.
 * Caller: TenantProvider and tenant selection tests.
 * Deps: Session snapshot types.
 * MainFuncs: Resolves initial tenant and active tenant permissions safely.
 * SideEffects: None.
 */
import type { SessionSnapshot, TenantMembershipSnapshot } from '@/features/auth/session-types';

export function resolveInitialTenantId(session: SessionSnapshot | null, requestedRtId?: string): string | undefined {
  if (!session || session.tenants.length === 0) {
    return undefined;
  }
  if (requestedRtId && session.tenants.some((tenant) => tenant.rtId === requestedRtId && isSelectableTenant(session, tenant))) {
    return requestedRtId;
  }
  return session.activeTenantId ?? session.tenants.find((tenant) => tenant.isDefault)?.rtId ?? session.tenants[0]?.rtId;
}

export function resolveActiveTenant(session: SessionSnapshot | null, activeTenantId?: string): TenantMembershipSnapshot | null {
  if (!session || session.tenants.length === 0) {
    return null;
  }
  return session.tenants.find((tenant) => tenant.rtId === activeTenantId) ?? session.tenants.find((tenant) => tenant.rtId === session.activeTenantId) ?? session.tenants[0] ?? null;
}

export function isSelectableTenant(session: SessionSnapshot | null, tenant: TenantMembershipSnapshot): boolean {
  if (!session) {
    return false;
  }
  return tenant.rtId === session.activeTenantId || tenant.permissions.length > 0;
}
