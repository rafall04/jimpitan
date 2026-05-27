/**
 * Purpose: Unit tests for same-origin browser auth client behavior.
 * Caller: Vitest test runner.
 * Deps: Auth client and ApiError.
 * MainFuncs: Verifies failed login state, session fetch, and logout request shape without exposing tokens.
 * SideEffects: Stubs global fetch during tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { fetchCurrentSession, loginWithPassword, logoutCurrentSession } from './auth-client';

describe('auth client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns failed login responses into ApiError without returning token data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ message: 'Invalid credentials.' }), { status: 401 })),
    );

    await expect(loginWithPassword({ identifier: 'bad@example.test', password: 'password-1', rtId: '' })).rejects.toBeInstanceOf(ApiError);
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
