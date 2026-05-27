/**
 * Purpose: Same-origin login route that stores backend tokens in httpOnly cookies.
 * Caller: LoginForm through the frontend auth client.
 * Deps: Backend auth adapter, login schema, session mapper, cookie helpers, and NextResponse.
 * MainFuncs: Validates login input, calls backend Auth login, writes safe cookies, and returns session metadata only.
 * SideEffects: Sets access, refresh, and session metadata cookies.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/lib/api/api-error';
import { backendLogin } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { loginFormSchema } from '@/features/auth/login.schema';
import { createSessionSnapshot } from '@/features/auth/session-mapper';
import { setSessionCookies } from '@/features/auth/session-cookies.server';

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Cross-origin auth requests are not allowed.' }, { status: 403 });
  }

  const parsed = loginFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: 'Login input is invalid.', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await backendLogin({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      rtId: parsed.data.rtId || undefined,
    });
    const session = createSessionSnapshot({
      user: result.user,
      principal: result.principal,
    });
    const response = NextResponse.json({ session });
    setSessionCookies(response, result.tokens, session);
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.message === 'Tenant context is required.') {
      return NextResponse.json({ code: 'TENANT_REQUIRED', message: 'Select an RT before signing in.' }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return NextResponse.json({ message: 'Login failed.' }, { status: 500 });
}
