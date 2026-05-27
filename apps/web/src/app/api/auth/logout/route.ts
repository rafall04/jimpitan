/**
 * Purpose: Same-origin logout route that clears frontend cookies and revokes backend refresh session.
 * Caller: Logout UI and auth client.
 * Deps: Next cookies, backend logout adapter, and cookie helpers.
 * MainFuncs: Attempts backend logout with the httpOnly refresh token and always clears local auth cookies.
 * SideEffects: Revokes backend refresh session when possible and clears cookies.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendLogout } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { clearSessionCookies } from '@/features/auth/session-cookies.server';
import { REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Cross-origin auth requests are not allowed.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await backendLogout(refreshToken).catch(() => undefined);
  }

  const response = NextResponse.json(null);
  clearSessionCookies(response);
  return response;
}
