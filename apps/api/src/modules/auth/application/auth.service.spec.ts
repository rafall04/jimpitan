/**
 * Purpose: Unit tests for AuthService login and refresh-token rotation.
 * Caller: Vitest test runner.
 * Deps: AuthService and Auth repository/token/password ports.
 * MainFuncs: Verifies secure password verification, tenant scoping, refresh-token hashing, rotation, replay handling, logout validation, and audit correlation.
 * SideEffects: None.
 */
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import type { AuthRepositoryPort } from '../infrastructure/auth.repository.port';
import type { PasswordHasherPort } from '../infrastructure/password-hasher.port';
import type { AuthTokenPort } from '../infrastructure/auth-token.port';

function createHarness() {
  const session = {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'hashed:old-refresh',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    revokedAt: null,
  };
  const principal = {
    userId: 'user-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['transactions.read'],
  };
  const repository: AuthRepositoryPort = {
    findLoginIdentity: vi.fn(async () => ({
      user: {
        id: 'user-1',
        fullName: 'Bendahara RT',
        email: 'bendahara@example.test',
        phone: '08123456789',
        status: 'ACTIVE',
        passwordHash: 'stored-password-hash',
      },
      memberships: [
        {
          id: 'membership-1',
          rtId: 'rt-1',
          roles: ['BENDAHARA'],
          permissions: ['transactions.read'],
        },
      ],
    })),
    createRefreshSession: vi.fn(async () => undefined),
    findRefreshSession: vi.fn(async () => session),
    rotateRefreshSession: vi.fn(async () => true),
    revokeRefreshSession: vi.fn(async () => undefined),
    resolvePrincipal: vi.fn(async () => principal),
    writeAuthAudit: vi.fn(async () => undefined),
  };
  const passwordHasher: PasswordHasherPort = {
    hash: vi.fn(async (value: string) => `hashed:${value}`),
    verify: vi.fn(async (value: string, hash: string) => hash === 'stored-password-hash' || hash === `hashed:${value}`),
  };
  const tokenService: AuthTokenPort = {
    signAccessToken: vi.fn(async () => 'access-token'),
    signRefreshToken: vi.fn(async () => 'new-refresh'),
    verifyAccessToken: vi.fn(async () => ({
      sub: 'user-1',
      membershipId: 'membership-1',
      rtId: 'rt-1',
      roles: ['BENDAHARA'],
      permissions: ['transactions.read'],
    })),
    verifyRefreshToken: vi.fn(async () => ({
      sub: 'user-1',
      sessionId: 'session-1',
      rtId: 'rt-1',
    })),
    getAccessExpiresInSeconds: vi.fn(() => 900),
    getRefreshExpiresAt: vi.fn(() => new Date('2030-01-01T00:00:00.000Z')),
  };

  return {
    repository,
    passwordHasher,
    tokenService,
    service: new AuthService(repository, passwordHasher, tokenService, () => 'session-1'),
  };
}

describe('AuthService', () => {
  it('logs in with verified password, stores only hashed refresh token, and returns a safe user', async () => {
    const { service, repository } = createHarness();

    const result = await service.login({
      identifier: 'bendahara@example.test',
      password: 'correct-password',
      rtId: 'rt-1',
      correlationId: 'corr-1',
    });

    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'new-refresh',
      expiresInSeconds: 900,
    });
    expect(result.user).toEqual({
      id: 'user-1',
      fullName: 'Bendahara RT',
      email: 'bendahara@example.test',
      phone: '08123456789',
      status: 'ACTIVE',
    });
    expect(repository.createRefreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenHash: 'hashed:new-refresh',
      }),
    );
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ correlationId: 'corr-1' }));
  });

  it('rejects login when password verification fails', async () => {
    const { service, passwordHasher } = createHarness();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(false);

    await expect(
      service.login({
        identifier: 'bendahara@example.test',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects ambiguous multi-RT login without explicit tenant selection', async () => {
    const { service, repository } = createHarness();
    vi.mocked(repository.findLoginIdentity).mockResolvedValueOnce({
      user: {
        id: 'user-1',
        fullName: 'Bendahara RT',
        email: 'bendahara@example.test',
        phone: '08123456789',
        status: 'ACTIVE',
        passwordHash: 'stored-password-hash',
      },
      memberships: [
        {
          id: 'membership-1',
          rtId: 'rt-1',
          roles: ['BENDAHARA'],
          permissions: ['transactions.read'],
        },
        {
          id: 'membership-2',
          rtId: 'rt-2',
          roles: ['WARGA'],
          permissions: ['reports.public.read'],
        },
      ],
    });

    await expect(
      service.login({
        identifier: 'bendahara@example.test',
        password: 'correct-password',
        correlationId: 'corr-tenant',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.createRefreshSession).not.toHaveBeenCalled();
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGIN_FAILED', correlationId: 'corr-tenant' }));
  });

  it('rotates refresh token and stores only the new refresh-token hash', async () => {
    const { service, repository } = createHarness();

    const tokens = await service.refresh({
      refreshToken: 'old-refresh',
      correlationId: 'corr-2',
    });

    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'new-refresh',
      expiresInSeconds: 900,
    });
    expect(repository.rotateRefreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        currentRefreshTokenHash: 'hashed:old-refresh',
        refreshTokenHash: 'hashed:new-refresh',
      }),
    );
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_REFRESH', correlationId: 'corr-2' }));
  });

  it('rejects refresh when atomic session rotation fails', async () => {
    const { service, repository } = createHarness();
    vi.mocked(repository.rotateRefreshSession).mockResolvedValueOnce(false);

    await expect(
      service.refresh({
        refreshToken: 'old-refresh',
        correlationId: 'corr-race',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.revokeRefreshSession).toHaveBeenCalledWith('session-1');
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_REFRESH_FAILED', correlationId: 'corr-race' }));
  });

  it('revokes the session when refresh-token hash verification fails', async () => {
    const { service, repository, passwordHasher } = createHarness();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(false);

    await expect(
      service.refresh({
        refreshToken: 'stale-refresh',
        correlationId: 'corr-replay',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.revokeRefreshSession).toHaveBeenCalledWith('session-1');
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_REFRESH_REPLAY_DETECTED', correlationId: 'corr-replay' }));
  });

  it('logs out only when the presented refresh token matches the stored session hash', async () => {
    const { service, repository } = createHarness();

    await service.logout({
      refreshToken: 'old-refresh',
      correlationId: 'corr-logout',
    });

    expect(repository.revokeRefreshSession).toHaveBeenCalledWith('session-1');
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGOUT', correlationId: 'corr-logout' }));
  });

  it('rejects stale logout tokens without revoking the active session', async () => {
    const { service, repository, passwordHasher } = createHarness();
    vi.mocked(passwordHasher.verify).mockResolvedValueOnce(false);

    await expect(
      service.logout({
        refreshToken: 'stale-refresh',
        correlationId: 'corr-stale-logout',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.revokeRefreshSession).not.toHaveBeenCalled();
    expect(repository.writeAuthAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUTH_LOGOUT_FAILED', correlationId: 'corr-stale-logout' }));
  });
});
