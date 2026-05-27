/**
 * Purpose: Unit tests for JWT token adapter payload validation.
 * Caller: Vitest test runner.
 * Deps: JwtAuthTokenService with mocked JwtService and ConfigService.
 * MainFuncs: Verifies signed token payloads must contain required auth and tenant claims.
 * SideEffects: None.
 */
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthTokenService } from './jwt-auth-token.service';

function createService(payload: unknown) {
  return new JwtAuthTokenService(
    {
      verifyAsync: vi.fn(async () => payload),
      signAsync: vi.fn(async () => 'token'),
    } as never,
    {
      get: vi.fn((_key: string, fallback?: unknown) => fallback),
      getOrThrow: vi.fn(() => 'secret-with-enough-length'),
    } as never,
  );
}

describe('JwtAuthTokenService', () => {
  it('rejects access tokens without tenant and membership claims', async () => {
    const service = createService({
      sub: 'user-1',
      roles: [],
      permissions: [],
    });

    await expect(service.verifyAccessToken('access-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh tokens without a session ID', async () => {
    const service = createService({
      sub: 'user-1',
      rtId: 'rt-1',
    });

    await expect(service.verifyRefreshToken('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
