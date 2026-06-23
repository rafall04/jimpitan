/**
 * Purpose: Same-origin auth session route that performs server-side login and access-token refresh fallback.
 * Caller: Browser auth client and TanStack Query session hook.
 * Deps: Next cookies, Zod, CSRF helper, backend auth adapter, session mapper/loader, and cookie helpers.
 * MainFuncs: Logs in to the backend server-side and stores tokens as httpOnly cookies, loads current user/profile/tenant context, and refreshes expired access tokens.
 * SideEffects: Sets or rotates auth cookies; does not clear cookies on refresh failure to avoid concurrent refresh races.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/api/api-error';
import { backendLogin } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { setSessionCookies } from '@/features/auth/session-cookies.server';
import { loadSessionWithRefresh } from '@/features/auth/session-loader.server';
import { createSessionSnapshot } from '@/features/auth/session-mapper';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';

const loginCredentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  rtId: z.string().min(1).optional(),
});

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

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Cross-origin auth session requests are not allowed.' }, { status: 403 });
  }

  const parsed = loginCredentialsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Login payload is invalid.', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const loginResult = await backendLogin({
      identifier: parsed.data.identifier.trim(),
      password: parsed.data.password,
      rtId: parsed.data.rtId,
    });
    const session = createSessionSnapshot({
      user: loginResult.user,
      principal: loginResult.principal,
    });
    const response = NextResponse.json({ session });
    setSessionCookies(response, loginResult.tokens, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof ApiError ? error.message : 'Login failed.' },
      { status: error instanceof ApiError ? error.status : 401 },
    );
  }
}
