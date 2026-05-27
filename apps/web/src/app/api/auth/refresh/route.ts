/**
 * Purpose: Same-origin explicit refresh route for auth session renewal.
 * Caller: Session hooks and future manual refresh flows.
 * Deps: Next cookies, backend refresh, session loader, and cookie helpers.
 * MainFuncs: Rotates backend refresh token, reloads session metadata, and updates httpOnly cookies.
 * SideEffects: Rotates or clears auth cookies.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/api-error';
import { backendRefresh } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { clearSessionCookies, setSessionCookies } from '@/features/auth/session-cookies.server';
import { loadSessionFromAccessToken } from '@/features/auth/session-loader.server';
import { REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Cross-origin auth requests are not allowed.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ message: 'Refresh token is missing.' }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  try {
    const tokens = await backendRefresh(refreshToken);
    const session = await loadSessionFromAccessToken(tokens.accessToken);
    const response = NextResponse.json({ session });
    setSessionCookies(response, tokens, session);
    return response;
  } catch (error) {
    const response = NextResponse.json({ message: error instanceof ApiError ? error.message : 'Refresh failed.' }, { status: error instanceof ApiError ? error.status : 401 });
    return response;
  }
}
