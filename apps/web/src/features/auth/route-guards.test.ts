/**
 * Purpose: Unit tests for protected and public route guard helpers.
 * Caller: Vitest test runner.
 * Deps: Route guard helpers.
 * MainFuncs: Verifies dashboard protection and safe login redirect path construction.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_META_COOKIE } from './session-types';
import { buildLoginRedirectPath, hasSessionCookieHint, isAuthPath, isProtectedPath } from './route-guards';

describe('route guards', () => {
  it('guards dashboard routes without guarding public routes', () => {
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/dashboard/residents')).toBe(true);
    expect(isProtectedPath('/reports')).toBe(false);
  });

  it('recognizes auth routes and creates login redirect paths', () => {
    expect(isAuthPath('/login')).toBe(true);
    expect(buildLoginRedirectPath('/dashboard/jimpitan')).toBe('/login?next=%2Fdashboard%2Fjimpitan');
  });

  it('allows refresh-cookie protected routes only when session metadata is present', () => {
    const cookieSet = new Set([REFRESH_TOKEN_COOKIE, SESSION_META_COOKIE]);
    expect(hasSessionCookieHint({ has: (name) => cookieSet.has(name) })).toBe(true);
    expect(hasSessionCookieHint({ has: (name) => name === REFRESH_TOKEN_COOKIE })).toBe(false);
    expect(hasSessionCookieHint({ has: (name) => name === ACCESS_TOKEN_COOKIE })).toBe(true);
  });
});
