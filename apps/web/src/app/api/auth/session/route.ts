/**
 * Purpose: Same-origin current session route with access-token refresh fallback.
 * Caller: TanStack Query session hook.
 * Deps: Next cookies, session loader, and cookie helpers.
 * MainFuncs: Loads current user/profile/tenant context and refreshes expired access tokens.
 * SideEffects: May rotate auth cookies; does not clear cookies on refresh failure to avoid concurrent refresh races.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/api-error';
import { setSessionCookies } from '@/features/auth/session-cookies.server';
import { loadSessionWithRefresh } from '@/features/auth/session-loader.server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';

export async function GET() {
  const cookieStore = await cookies();
  try {
    const loaded = await loadSessionWithRefresh({
      accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value,
      refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value,
    });
    const response = NextResponse.json({ session: loaded.session });
    if (loaded.tokens) {
      setSessionCookies(response, loaded.tokens, loaded.session);
    }
    return response;
  } catch (error) {
    const response = NextResponse.json({ message: error instanceof ApiError ? error.message : 'Session is unavailable.' }, { status: error instanceof ApiError ? error.status : 401 });
    return response;
  }
}
