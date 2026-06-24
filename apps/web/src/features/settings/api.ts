/**
 * Purpose: Browser API adapter for tenant-scoped settings (public finance visibility).
 * Caller: Settings TanStack hooks.
 * Deps: Same-origin backend proxy (/api/backend/settings), ApiError.
 * MainFuncs: Reads, sets, and regenerates the kas visibility + token.
 * SideEffects: Browser fetch with cookies + active tenant header.
 */
import { ApiError } from '@/lib/api/api-error';
import type { FinanceVisibility, FinanceVisibilityMode } from './types';

const BASE = '/api/backend/settings';

export async function getFinanceVisibility(tenantId: string): Promise<FinanceVisibility> {
  return appApiJson(`${BASE}/finance-visibility`, { tenantId });
}

export async function setFinanceVisibility(tenantId: string, mode: FinanceVisibilityMode): Promise<FinanceVisibility> {
  return appApiJson(`${BASE}/finance-visibility`, { method: 'PUT', tenantId, body: { mode } });
}

export async function regenerateFinanceToken(tenantId: string): Promise<FinanceVisibility> {
  return appApiJson(`${BASE}/finance-visibility/regenerate-token`, { method: 'POST', tenantId });
}

async function appApiJson<T>(path: string, options: { method?: string; tenantId: string; body?: unknown }): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Tenant-Id', options.tenantId);
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'include', headers };
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new ApiError(resolveMessage(payload, response.statusText), response.status, payload, requestId);
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback;
  }
  return fallback || 'Permintaan gagal.';
}
