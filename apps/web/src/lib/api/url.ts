/**
 * Purpose: Safe API URL joining that preserves configured base paths.
 * Caller: Browser API client, server backend adapters, and tests.
 * Deps: URL standard library.
 * MainFuncs: Joins relative API paths to absolute base URLs without dropping path prefixes like /api/v1.
 * SideEffects: None.
 */
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

export function joinApiUrl(baseUrl: string, path: string): URL {
  if (ABSOLUTE_URL_PATTERN.test(path) || path.startsWith('//')) {
    throw new Error('API paths must be relative to the configured base URL.');
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase);
}
