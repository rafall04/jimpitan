/**
 * Purpose: Membership option helpers for Jimpitan officer assignment UI.
 * Caller: Jimpitan pages and tests.
 * Deps: Tenant session snapshots and Jimpitan membership row type.
 * MainFuncs: Builds safe fallback officer options when users.read membership listing is unavailable.
 * SideEffects: None.
 */
import type { SessionSnapshot, TenantMembershipSnapshot } from '@/features/auth/session-types';
import type { TenantMembershipRow } from './types';

export function membershipRowsFromSession(session: SessionSnapshot | null, activeTenant: TenantMembershipSnapshot | null): TenantMembershipRow[] {
  if (!session || !activeTenant) {
    return [];
  }
  return [
    {
      id: activeTenant.id,
      rtId: activeTenant.rtId,
      status: 'ACTIVE',
      roles: activeTenant.roleNames.map((name) => ({ id: name, key: name, name, rtId: activeTenant.rtId, isSystem: false })),
      user: {
        id: session.user.id,
        fullName: session.user.name,
        email: session.user.email,
        phone: null,
        status: session.user.status ?? 'ACTIVE',
      },
    },
  ];
}
