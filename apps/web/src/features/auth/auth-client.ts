/**
 * Purpose: Browser auth client for configured backend login and same-origin session routes.
 * Caller: Login form, session hooks, logout UI, and tests.
 * Deps: Frontend environment parser, API URL helper, ApiError, and auth/session response types.
 * MainFuncs: Calls backend login through NEXT_PUBLIC_API_BASE_URL and uses same-origin session routes for cookie-backed session state.
 * SideEffects: Performs browser fetch requests and relies on httpOnly cookies set by route handlers after login.
 */
import { ApiError } from '@/lib/api/api-error';
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';
import type { LoginFormValues } from './login.schema';
import type { BackendPrincipal, BackendSafeUser } from './session-mapper';
import type { SessionSnapshot } from './session-types';

export type AuthSessionResponse = {
  session: SessionSnapshot;
};

type DirectBackendLoginResult = {
  user: BackendSafeUser;
  principal: BackendPrincipal;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  };
};

export async function loginWithPassword(values: LoginFormValues): Promise<AuthSessionResponse> {
  const loginResult = await authJson<DirectBackendLoginResult>(joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, '/auth/login').toString(), {
    method: 'POST',
    body: JSON.stringify({
      identifier: values.identifier.trim(),
      password: values.password,
      rtId: values.rtId || undefined,
    }),
  });
  return authJson<AuthSessionResponse>('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify(loginResult),
  });
}

export async function fetchCurrentSession(): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>('/api/auth/session', { method: 'GET' });
}

export async function refreshCurrentSession(): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>('/api/auth/refresh', { method: 'POST' });
}

export async function logoutCurrentSession(): Promise<void> {
  await authJson<null>('/api/auth/logout', { method: 'POST' });
}

async function authJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
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
  if (payload && typeof payload === 'object' && 'message' in payload && typeof (payload as { message?: unknown }).message === 'string') {
    return (payload as { message: string }).message;
  }
  return fallback || 'Authentication request failed.';
}
