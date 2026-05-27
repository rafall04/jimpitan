/**
 * Purpose: Maps backend auth/profile/tenant responses into frontend session metadata.
 * Caller: Next auth route handlers and unit tests.
 * Deps: Session type definitions.
 * MainFuncs: Builds non-sensitive session snapshots from backend-safe shapes.
 * SideEffects: None.
 */
import type { SessionSnapshot, TenantMembershipSnapshot } from './session-types';

export type BackendPrincipal = {
  userId: string;
  membershipId: string;
  rtId: string;
  roles: string[];
  permissions: string[];
};

export type BackendSafeUser = {
  id: string;
  fullName: string;
  email: string | null;
  status: string;
};

export type BackendTenant = {
  id: string;
  name: string;
  code: string;
};

export type BackendMembership = {
  id: string;
  rtId: string;
  status: string;
  roles: { key?: string; name?: string }[];
};

export function createSessionSnapshot(input: {
  user: BackendSafeUser;
  principal: BackendPrincipal;
  currentTenant?: BackendTenant | null;
  memberships?: BackendMembership[];
}): SessionSnapshot {
  const membershipRows = input.memberships && input.memberships.length > 0 ? input.memberships : [currentMembershipFromPrincipal(input.principal)];
  const tenants = membershipRows.map((membership) => toTenantSnapshot(membership, input.principal, input.currentTenant));

  return {
    user: {
      id: input.user.id,
      name: input.user.fullName,
      email: input.user.email,
      status: input.user.status,
    },
    activeTenantId: input.principal.rtId,
    tenants,
  };
}

function currentMembershipFromPrincipal(principal: BackendPrincipal): BackendMembership {
  return {
    id: principal.membershipId,
    rtId: principal.rtId,
    status: 'ACTIVE',
    roles: principal.roles.map((role) => ({ key: role, name: role })),
  };
}

function toTenantSnapshot(membership: BackendMembership, principal: BackendPrincipal, currentTenant?: BackendTenant | null): TenantMembershipSnapshot {
  const isCurrent = membership.rtId === principal.rtId;
  const roleNames = isCurrent ? principal.roles : membership.roles.map((role) => role.key ?? role.name ?? 'ROLE');

  return {
    id: membership.id,
    rtId: membership.rtId,
    rtCode: isCurrent && currentTenant ? currentTenant.code : membership.rtId,
    rtName: isCurrent && currentTenant ? currentTenant.name : `RT ${membership.rtId}`,
    roleNames,
    permissions: isCurrent ? principal.permissions : [],
    isDefault: isCurrent,
  };
}
