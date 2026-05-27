/**
 * Purpose: Server-only cookie helpers for auth token and session metadata storage.
 * Caller: Next auth route handlers.
 * Deps: NextResponse and session type constants.
 * MainFuncs: Sets and clears httpOnly access, refresh, and session metadata cookies.
 * SideEffects: Mutates response cookies.
 */
import 'server-only';

import type { NextResponse } from 'next/server';
import type { SessionSnapshot } from './session-types';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_META_COOKIE } from './session-types';

const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type IssuedAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
};

export function setSessionCookies(response: NextResponse, tokens: IssuedAuthTokens, session: SessionSnapshot): void {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expiresInSeconds,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
  response.cookies.set(SESSION_META_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_META_COOKIE]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
}
