/**
 * Purpose: JWT token contract for Auth application logic.
 * Caller: AuthService and auth guard.
 * Deps: Auth token payload types.
 * MainFuncs: Defines access/refresh token signing and verification operations.
 * SideEffects: None.
 */
import type { AccessTokenPayload, RefreshTokenPayload } from '../domain/auth.types';

export interface AuthTokenPort {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  signRefreshToken(payload: RefreshTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
  getAccessExpiresInSeconds(): number;
  getRefreshExpiresAt(): Date;
}
