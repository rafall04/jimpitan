/**
 * Purpose: Safe redirect normalization for auth flows.
 * Caller: Login form, auth tests, and future auth route helpers.
 * Deps: None.
 * MainFuncs: Accepts same-app relative redirects and rejects open-redirect targets.
 * SideEffects: None.
 */
const FALLBACK_PRIVATE_PATH = '/dashboard';
const BLOCKED_PREFIXES = ['/api', '/login'];
const ALLOWED_PREFIXES = ['/dashboard'];

export function sanitizeRedirectPath(candidate: string | null | undefined): string {
  if (!candidate) {
    return FALLBACK_PRIVATE_PATH;
  }

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return FALLBACK_PRIVATE_PATH;
  }

  try {
    const url = new URL(candidate, 'http://jimpitan.local');
    if (url.origin !== 'http://jimpitan.local') {
      return FALLBACK_PRIVATE_PATH;
    }
    if (BLOCKED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      return FALLBACK_PRIVATE_PATH;
    }
    if (!ALLOWED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
      return FALLBACK_PRIVATE_PATH;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK_PRIVATE_PATH;
  }
}
