/**
 * Purpose: Same-origin auth session route with login persistence and access-token refresh fallback.
 * Caller: Browser auth client and TanStack Query session hook.
 * Deps: Next cookies, Zod, CSRF helper, session mapper/loader, and cookie helpers.
 * MainFuncs: Persists direct backend login responses, loads current user/profile/tenant context, and refreshes expired access tokens.
 * SideEffects: Sets or rotates auth cookies; does not clear cookies on refresh failure to avoid concurrent refresh races.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError } from '@/lib/api/api-error';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { setSessionCookies } from '@/features/auth/session-cookies.server';
import { loadSessionWithRefresh } from '@/features/auth/session-loader.server';
import { createSessionSnapshot } from '@/features/auth/session-mapper';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';

const directBackendLoginSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    fullName: z.string().min(1),
    email: z.string().nullable(),
    status: z.string().min(1),
  }),
  principal: z.object({
    userId: z.string().min(1),
    membershipId: z.string().min(1),
    rtId: z.string().min(1),
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  }),
  tokens: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresInSeconds: z.number().int().positive(),
  }),
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

  const parsed = directBackendLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Login session payload is invalid.', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const session = createSessionSnapshot({
    user: parsed.data.user,
    principal: parsed.data.principal,
  });
  const response = NextResponse.json({ session });
  setSessionCookies(response, parsed.data.tokens, session);
  return response;
}
