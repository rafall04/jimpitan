/**
 * Purpose: Shared authentication domain types for the Auth module boundary.
 * Caller: Auth application contracts, future guards, and future controllers.
 * Deps: None.
 * MainFuncs: Defines token payload, authenticated principal, and issued-token shapes.
 * SideEffects: None.
 */
export type AuthPrincipal = {
  userId: string;
  membershipId: string;
  rtId: string;
  roles: string[];
  permissions: string[];
};

export type AccessTokenPayload = {
  sub: string;
  membershipId: string;
  rtId: string;
  roles: string[];
  permissions: string[];
};

export type RefreshTokenPayload = {
  sub: string;
  sessionId: string;
  rtId: string;
};

export type IssuedAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

export type SafeAuthUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
};

export type AuthMembershipGrant = {
  id: string;
  rtId: string;
  roles: string[];
  permissions: string[];
};

export type AuthLoginIdentity = {
  user: SafeAuthUser & {
    passwordHash: string | null;
  };
  memberships: AuthMembershipGrant[];
};

export type RefreshSessionRecord = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};
