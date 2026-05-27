/**
 * Purpose: Unit tests for AuthController request metadata handling.
 * Caller: Vitest test runner.
 * Deps: AuthController and mocked AuthService.
 * MainFuncs: Verifies auth endpoints do not trust spoofable proxy IP headers by default.
 * SideEffects: None.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import type { AuthService } from '../application/auth.service';
import type { RequestWithContext } from '../../../common/types/request-context.type';

describe('AuthController', () => {
  it('uses the socket IP instead of spoofable x-forwarded-for for auth logs', async () => {
    const authService = {
      login: vi.fn(async () => ({
        user: {
          id: 'user-1',
          fullName: 'Bendahara RT',
          email: 'bendahara@example.test',
          phone: null,
          status: 'ACTIVE',
        },
        principal: {
          userId: 'user-1',
          membershipId: 'membership-1',
          rtId: 'rt-1',
          roles: ['BENDAHARA'],
          permissions: ['transactions.read'],
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresInSeconds: 900,
        },
      })),
    } as unknown as AuthService;
    const controller = new AuthController(authService);

    await controller.login(
      {
        identifier: 'bendahara@example.test',
        password: 'correct-password',
        rtId: 'rt-1',
      },
      {
        correlationId: 'corr-ip',
        ip: '10.0.0.2',
        headers: {
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'vitest',
        },
      } as unknown as RequestWithContext,
    );

    expect(authService.login).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '10.0.0.2' }));
  });
});
