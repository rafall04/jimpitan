/**
 * Purpose: Repository contract for future Auth persistence operations.
 * Caller: Future AuthService implementation.
 * Deps: Auth domain types.
 * MainFuncs: Defines persistence boundary without Prisma queries or auth logic.
 * SideEffects: None.
 */
import type { AuthLoginIdentity, AuthPrincipal, RefreshSessionRecord } from '../domain/auth.types';

export type CreateRefreshSessionInput = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
};

export type RotateRefreshSessionInput = {
  sessionId: string;
  currentRefreshTokenHash: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
};

export type AuthAuditInput = {
  action: string;
  userId?: string;
  rtId?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export interface AuthRepositoryPort {
  findLoginIdentity(identifier: string): Promise<AuthLoginIdentity | null>;
  createRefreshSession(input: CreateRefreshSessionInput): Promise<void>;
  findRefreshSession(sessionId: string): Promise<RefreshSessionRecord | null>;
  rotateRefreshSession(input: RotateRefreshSessionInput): Promise<boolean>;
  revokeRefreshSession(sessionId: string): Promise<void>;
  resolvePrincipal(userId: string, rtId?: string): Promise<AuthPrincipal | null>;
  writeAuthAudit(input: AuthAuditInput): Promise<void>;
}
