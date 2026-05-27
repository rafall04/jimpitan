/**
 * Purpose: Same-origin request validation for cookie-authenticated auth route handlers.
 * Caller: Login, refresh, and logout route handlers.
 * Deps: NextRequest type.
 * MainFuncs: Rejects cross-site browser POSTs while allowing same-origin and non-browser server requests.
 * SideEffects: None.
 */
import type { NextRequest } from 'next/server';

export type SameOriginHeaderSet = {
  origin?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  secFetchSite?: string | null;
};

export function isSameOriginRequest(request: NextRequest): boolean {
  return isSameOriginHeaderSet({
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    forwardedHost: request.headers.get('x-forwarded-host'),
    secFetchSite: request.headers.get('sec-fetch-site'),
  });
}

export function isSameOriginHeaderSet(headers: SameOriginHeaderSet): boolean {
  if (headers.origin) {
    return originMatchesHost(headers.origin, headers.forwardedHost ?? headers.host);
  }

  if (headers.secFetchSite) {
    return headers.secFetchSite === 'same-origin' || headers.secFetchSite === 'same-site' || headers.secFetchSite === 'none';
  }

  return true;
}

function originMatchesHost(origin: string, host: string | null | undefined): boolean {
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
