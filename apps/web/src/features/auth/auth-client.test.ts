/**
 * Purpose: Unit tests for same-origin browser auth client behavior.
 * Caller: Vitest test runner.
 * Deps: Auth client and ApiError.
 * MainFuncs: Verifies same-origin login credential payload, failed login state, session fetch, and logout request shape without exposing tokens.
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

  it('posts login credentials to the same-origin session route and returns only session metadata', async () => {
    const session = { user: { id: 'user-1', name: 'Admin', email: 'admin@jimpitan.local' }, tenants: [], activeTenantId: 'tenant-1' };
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({ session }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithPassword({ identifier: ' admin@jimpitan.local ', password: 'password', rtId: '' })).resolves.toEqual({ session });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({ identifier: 'admin@jimpitan.local', password: 'password', rtId: undefined }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toHaveProperty('identifier', 'admin@jimpitan.local');
    expect(body).not.toHaveProperty('accessToken');
  });

  it('never calls the backend API directly from the browser', async () => {
    const session = { user: { id: 'user-1', name: 'Admin', email: 'admin@jimpitan.local' }, tenants: [], activeTenantId: 'tenant-1' };
    const fetchMock = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({ session }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await loginWithPassword({ identifier: 'admin@jimpitan.local', password: 'password', rtId: '' });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/api/auth/session']);
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
