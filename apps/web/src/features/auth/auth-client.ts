/**
 * Purpose: Browser auth client for same-origin auth session/refresh/logout routes.
 * Caller: Login form, session hooks, logout UI, and tests.
 * Deps: ApiError and auth/session response types.
 * MainFuncs: Posts login credentials to the same-origin session route (which logs in to the backend server-side) and reads cookie-backed session state.
 * SideEffects: Performs same-origin browser fetch requests; the browser never receives backend tokens (set as httpOnly cookies by the route handlers).
 */
import { ApiError } from '@/lib/api/api-error';
import type { LoginFormValues } from './login.schema';
import type { SessionSnapshot } from './session-types';

export type AuthSessionResponse = {
  session: SessionSnapshot;
};

export async function loginWithPassword(values: LoginFormValues): Promise<AuthSessionResponse> {
  return authJson<AuthSessionResponse>('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({
      identifier: values.identifier.trim(),
      password: values.password,
      rtId: values.rtId || undefined,
    }),
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
