/**
 * Purpose: Non-sensitive frontend auth session metadata types.
 * Caller: Middleware, server session reader, tenant provider, and dashboard shell.
 * Deps: None.
 * MainFuncs: Defines cookie names and session/tenant snapshot shapes.
 * SideEffects: None.
 */
export const ACCESS_TOKEN_COOKIE = 'jimpitan_access_token';
export const REFRESH_TOKEN_COOKIE = 'jimpitan_refresh_token';
export const SESSION_META_COOKIE = 'jimpitan_session_meta';

export type TenantMembershipSnapshot = {
  id: string;
  rtId: string;
  rtCode: string;
  rtName: string;
  roleNames: string[];
  permissions: string[];
  isDefault?: boolean;
};

export type SessionSnapshot = {
  user: {
    id: string;
    name: string;
    email: string | null;
    status?: string;
  };
  activeTenantId?: string;
  tenants: TenantMembershipSnapshot[];
};
