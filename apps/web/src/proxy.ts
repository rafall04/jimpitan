/**
 * Purpose: Next.js request proxy for public/private route separation.
 * Caller: Next.js proxy runtime before App Router rendering.
 * Deps: Session cookie names from auth session types.
 * MainFuncs: Guards dashboard routes and redirects authenticated users away from login.
 * SideEffects: May return redirects before route rendering.
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildLoginRedirectPath, hasSessionCookieHint, isAuthPath, isProtectedPath } from './features/auth/route-guards';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasSession = hasSessionCookieHint(request.cookies);

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = new URL(buildLoginRedirectPath(pathname), request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath(pathname) && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
