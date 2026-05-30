/**
 * Purpose: Unit tests for same-origin browser auth client behavior.
 * Caller: Vitest test runner.
 * Deps: Auth client and ApiError.
 * MainFuncs: Verifies backend login URL/payload, failed login state, session fetch, and logout request shape without storing tokens.
 * SideEffects: Stubs global fetch during tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { fetchCurrentSession, loginWithPassword, logoutCurrentSession } from './auth-client';

describe('auth client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('turns failed login responses into ApiError without returning token data', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://172.17.11.12:3101/api/v1');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid credentials.' }), { status: 401 })),
    );

    await expect(loginWithPassword({ identifier: 'bad@example.test', password: 'password-1', rtId: '' })).rejects.toBeInstanceOf(ApiError);
  });

  it('posts login credentials to NEXT_PUBLIC_API_BASE_URL with identifier payload', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://172.17.11.12:3101/api/v1');
    const session = { user: { id: 'user-1', name: 'Admin', email: 'admin@jimpitan.local' }, tenants: [], activeTenantId: 'tenant-1' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'user-1', fullName: 'Admin', email: 'admin@jimpitan.local', status: 'ACTIVE' },
            principal: { userId: 'user-1', membershipId: 'membership-1', rtId: 'tenant-1', roles: ['SUPER_ADMIN'], permissions: ['*'] },
            tokens: { accessToken: 'access-token', refreshToken: 'refresh-token', expiresInSeconds: 900 },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ session }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithPassword({ identifier: ' admin@jimpitan.local ', password: 'password', rtId: '' })).resolves.toEqual({ session });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://172.17.11.12:3101/api/v1/auth/login',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ identifier: 'admin@jimpitan.local', password: 'password', rtId: undefined }),
      }),
    );
    const loginBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(loginBody).toHaveProperty('identifier', 'admin@jimpitan.local');
    expect(loginBody).not.toHaveProperty('email');
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain('/api/auth/login');
  });

  it('fails before login fetch when NEXT_PUBLIC_API_BASE_URL is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithPassword({ identifier: 'admin@jimpitan.local', password: 'password', rtId: '' })).rejects.toThrow('NEXT_PUBLIC_API_BASE_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads current session through the same-origin session endpoint', async () => {
    const session = { user: { id: 'user-1', name: 'Bendahara', email: 'bendahara@example.test' }, tenants: [], activeTenantId: undefined };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ session }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCurrentSession()).resolves.toEqual({ session });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ credentials: 'include', method: 'GET' }));
  });

  it('posts logout through the same-origin logout endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response('null', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await logoutCurrentSession();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ credentials: 'include', method: 'POST' }));
  });
});
