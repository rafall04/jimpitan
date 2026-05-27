/**
 * Purpose: Pure route guard helpers for public/private auth routing.
 * Caller: Next.js proxy and route guard tests.
 * Deps: None.
 * MainFuncs: Detects protected/auth paths and builds safe login redirects.
 * SideEffects: None.
 */
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_META_COOKIE } from './session-types';

const PRIVATE_PREFIXES = ['/dashboard'];
const AUTH_PATHS = ['/login'];

export type AuthCookieReader = {
  has(name: string): boolean;
};

export function isProtectedPath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(pathname);
}

export function buildLoginRedirectPath(pathname: string): string {
  const params = new URLSearchParams({ next: pathname });
  return `/login?${params.toString()}`;
}

export function hasSessionCookieHint(cookies: AuthCookieReader): boolean {
  return cookies.has(ACCESS_TOKEN_COOKIE) || (cookies.has(REFRESH_TOKEN_COOKIE) && cookies.has(SESSION_META_COOKIE));
}
