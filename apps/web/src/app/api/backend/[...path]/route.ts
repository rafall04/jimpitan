/**
 * Purpose: Same-origin proxy for tenant-scoped backend dashboard APIs.
 * Caller: Browser feature API clients under the authenticated dashboard.
 * Deps: Next route handlers, backend auth refresh adapter, session cookies, CSRF helper, and API URL helpers.
 * MainFuncs: Forwards allowlisted business requests with httpOnly bearer cookies and tenant headers.
 * SideEffects: Performs server-side backend fetches and may rotate auth cookies after refresh.
 */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { backendRefresh } from '@/features/auth/backend-auth.server';
import { isSameOriginRequest } from '@/features/auth/csrf.server';
import { readSessionSnapshot } from '@/features/auth/session.server';
import { setSessionCookies } from '@/features/auth/session-cookies.server';
import { loadSessionFromAccessToken } from '@/features/auth/session-loader.server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/features/auth/session-types';
import { ApiError } from '@/lib/api/api-error';
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';

const ALLOWED_RESOURCES = new Set(['residents', 'houses', 'areas', 'jimpitan', 'finance', 'ledger', 'approvals', 'reports', 'content', 'settings']);
const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyBackendRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyBackendRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyBackendRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyBackendRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyBackendRequest(request, context);
}

async function proxyBackendRequest(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (STATE_CHANGING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json({ message: 'Cross-origin API requests are not allowed.' }, { status: 403 });
  }

  const { path } = await context.params;
  if (!isAllowedPath(path, request.method)) {
    return NextResponse.json({ message: 'Backend route is not exposed to the browser.' }, { status: 404 });
  }

  const session = await readSessionSnapshot();
  const tenantId = request.headers.get('X-Tenant-Id');
  if (!session?.activeTenantId || !tenantId || tenantId !== session.activeTenantId) {
    return NextResponse.json({ message: 'Active tenant context is required.' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  // Read as raw bytes (not text) so binary multipart uploads (content images) are forwarded intact.
  const bodyBuffer = await request.arrayBuffer();

  try {
    const initial = await forwardToBackend(request, path, tenantId, accessToken, bodyBuffer);
    if (initial.status !== 401 || !refreshToken) {
      return initial;
    }

    const tokens = await backendRefresh(refreshToken);
    const refreshedSession = await loadSessionFromAccessToken(tokens.accessToken);
    if (refreshedSession.activeTenantId !== tenantId) {
      return NextResponse.json({ message: 'Refreshed tenant context does not match the active RT.' }, { status: 403 });
    }

    const retried = await forwardToBackend(request, path, tenantId, tokens.accessToken, bodyBuffer);
    setSessionCookies(retried, tokens, refreshedSession);
    return retried;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Backend request failed.';
    return NextResponse.json({ message }, { status });
  }
}

async function forwardToBackend(request: NextRequest, path: string[], tenantId: string, accessToken: string | undefined, bodyBuffer: ArrayBuffer): Promise<NextResponse> {
  if (!accessToken) {
    return NextResponse.json({ message: 'Authentication is required.' }, { status: 401 });
  }

  const backendPath = `${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const url = joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, backendPath);
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('X-Tenant-Id', tenantId);

  const contentType = request.headers.get('content-type');
  const idempotencyKey = request.headers.get('idempotency-key');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  if (idempotencyKey) {
    headers.set('Idempotency-Key', idempotencyKey);
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
    cache: 'no-store',
  });
  const payload = await response.text();
  const proxied = new NextResponse(payload, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
  const contentDisposition = response.headers.get('content-disposition');
  if (contentDisposition) {
    proxied.headers.set('Content-Disposition', contentDisposition);
  }
  const requestId = response.headers.get('X-Request-Id');
  if (requestId) {
    proxied.headers.set('X-Request-Id', requestId);
  }
  return proxied;
}

function isAllowedPath(path: string[], method: string): boolean {
  if (!path.every((segment) => segment.length > 0 && !segment.includes('..'))) {
    return false;
  }
  if (path.length > 0 && ALLOWED_RESOURCES.has(path[0])) {
    return true;
  }
  return method === 'GET' && path.length === 2 && path[0] === 'users' && path[1] === 'memberships';
}
