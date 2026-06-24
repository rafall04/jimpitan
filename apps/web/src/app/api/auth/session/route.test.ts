/**
 * Purpose: Handler tests for the same-origin auth session route's server-side login.
 * Caller: Vitest test runner.
 * Deps: Mocked backend auth adapter, cookie writer, CSRF helper, session mapper, and next/headers.
 * MainFuncs: Verifies server-side login orchestration, CSRF rejection, payload validation, backend-failure propagation, and that tokens never reach the response body.
 * SideEffects: None; all server-only collaborators are mocked.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { backendLogin } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { setSessionCookies } from '@/features/auth/session-cookies.server';
import { POST } from './route';

const fixtures = vi.hoisted(() => ({
  session: { user: { id: 'user-1', name: 'Admin', email: null }, tenants: [], activeTenantId: 'tenant-1' },
  tokens: { accessToken: 'access-token-value', refreshToken: 'refresh-token-value', expiresInSeconds: 900 },
}));

vi.mock('@/features/auth/backend-auth.server', () => ({ backendLogin: vi.fn() }));
vi.mock('@/features/auth/session-cookies.server', () => ({ setSessionCookies: vi.fn() }));
vi.mock('@/features/auth/csrf.server', () => ({ isSameOriginRequest: vi.fn(() => true) }));
vi.mock('@/features/auth/session-loader.server', () => ({ loadSessionWithRefresh: vi.fn(), loadSessionFromAccessToken: vi.fn(async () => fixtures.session) }));
vi.mock('@/features/auth/session-mapper', () => ({ createSessionSnapshot: vi.fn(() => fixtures.session) }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

function postRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/session', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSameOriginRequest).mockReturnValue(true);
    vi.mocked(backendLogin).mockResolvedValue({
      user: { id: 'user-1', fullName: 'Admin', email: null, status: 'ACTIVE' },
      principal: { userId: 'user-1', membershipId: 'membership-1', rtId: 'tenant-1', roles: ['SUPER_ADMIN'], permissions: ['*'] },
      tokens: fixtures.tokens,
    });
  });

  it('logs in to the backend server-side, sets cookies, and returns only session metadata', async () => {
    const response = await POST(postRequest({ identifier: ' admin@jimpitan.local ', password: 'secret' }));
    const json = await response.json();

    expect(vi.mocked(backendLogin)).toHaveBeenCalledWith({ identifier: 'admin@jimpitan.local', password: 'secret', rtId: undefined });
    expect(vi.mocked(setSessionCookies)).toHaveBeenCalledWith(expect.anything(), fixtures.tokens, fixtures.session);
    expect(json).toEqual({ session: fixtures.session });
    expect(JSON.stringify(json)).not.toContain('access-token-value');
    expect(JSON.stringify(json)).not.toContain('refresh-token-value');
  });

  it('rejects cross-origin requests with 403 and never logs in', async () => {
    vi.mocked(isSameOriginRequest).mockReturnValue(false);

    const response = await POST(postRequest({ identifier: 'admin@jimpitan.local', password: 'secret' }));

    expect(response.status).toBe(403);
    expect(vi.mocked(backendLogin)).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads with 400 before contacting the backend', async () => {
    const response = await POST(postRequest({ identifier: '' }));

    expect(response.status).toBe(400);
    expect(vi.mocked(backendLogin)).not.toHaveBeenCalled();
  });

  it('propagates backend auth failure status without setting cookies', async () => {
    vi.mocked(backendLogin).mockRejectedValue(new ApiError('Invalid credentials.', 401, null));

    const response = await POST(postRequest({ identifier: 'admin@jimpitan.local', password: 'wrong' }));

    expect(response.status).toBe(401);
    expect(vi.mocked(setSessionCookies)).not.toHaveBeenCalled();
  });
});
