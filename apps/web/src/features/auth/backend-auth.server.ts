/**
 * Purpose: Server-only backend Auth/RBAC API adapter for Next auth route handlers.
 * Caller: app/api/auth route handlers.
 * Deps: Frontend environment parser, ApiError, and auth session mapper types.
 * MainFuncs: Calls backend login, refresh, logout, principal, profile, memberships, and current-tenant endpoints.
 * SideEffects: Performs server-side fetch requests to the backend API.
 */
import 'server-only';

import { ApiError } from '@/lib/api/api-error';
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';
import type { IssuedAuthTokens } from './session-cookies.server';
import type { BackendMembership, BackendPrincipal, BackendSafeUser, BackendTenant } from './session-mapper';

export type BackendLoginResult = {
  user: BackendSafeUser;
  principal: BackendPrincipal;
  tokens: IssuedAuthTokens;
};

export async function backendLogin(input: { identifier: string; password: string; rtId?: string }): Promise<BackendLoginResult> {
  return backendJson<BackendLoginResult>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function backendRefresh(refreshToken: string): Promise<IssuedAuthTokens> {
  return backendJson<IssuedAuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function backendLogout(refreshToken: string): Promise<void> {
  await backendJson<null>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function backendGetPrincipal(accessToken: string): Promise<BackendPrincipal> {
  const result = await backendJson<{ principal: BackendPrincipal }>('/auth/me', {
    method: 'GET',
    accessToken,
  });
  return result.principal;
}

export async function backendGetProfile(accessToken: string, rtId: string): Promise<BackendSafeUser> {
  const profile = await backendJson<BackendSafeUser & { createdAt?: string; updatedAt?: string }>('/users/me', {
    method: 'GET',
    accessToken,
    rtId,
  });
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    status: profile.status,
  };
}

export async function backendGetMemberships(accessToken: string, rtId: string): Promise<BackendMembership[]> {
  return backendJson<BackendMembership[]>('/users/me/memberships', {
    method: 'GET',
    accessToken,
    rtId,
  });
}

export async function backendGetCurrentTenant(accessToken: string, rtId: string): Promise<BackendTenant> {
  return backendJson<BackendTenant>('/tenants/current', {
    method: 'GET',
    accessToken,
    rtId,
  });
}

async function backendJson<T>(
  path: string,
  init: RequestInit & {
    accessToken?: string;
    rtId?: string;
  },
): Promise<T> {
  const { accessToken, rtId, ...fetchOptions } = init;
  const url = joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, path);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (rtId) {
    headers.set('X-Tenant-Id', rtId);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    cache: 'no-store',
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError(resolveMessage(payload, response.statusText), response.status, payload, response.headers.get('X-Request-Id') ?? undefined);
  }

  return payload as T;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }
  return fallback || 'Backend request failed.';
}
