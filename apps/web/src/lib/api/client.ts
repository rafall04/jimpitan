/**
 * Purpose: Tenant-aware HTTP client foundation for backend API calls.
 * Caller: Feature hooks, forms, and mutation handlers.
 * Deps: Frontend environment parser and ApiError.
 * MainFuncs: Builds typed GET/POST/PATCH/DELETE requests with credentials, tenant headers, and idempotency headers.
 * SideEffects: Performs browser or server fetch requests.
 */
import { getWebEnv } from '@/lib/env/env';
import { ApiError } from './api-error';
import { joinApiUrl } from './url';

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
  tenantId?: string;
  idempotencyKey?: string;
};

export type ApiClient = {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  request<T>(path: string, options?: ApiRequestOptions): Promise<T>;
};

export type CreateApiClientOptions = {
  baseUrl: string;
};

export function createApiClient({ baseUrl }: CreateApiClientOptions): ApiClient {
  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const url = joinApiUrl(baseUrl, path);
    const headers = new Headers(options.headers);
    const { body, tenantId, idempotencyKey, ...fetchOptions } = options;
    headers.set('Accept', 'application/json');

    if (tenantId) {
      headers.set('X-Tenant-Id', tenantId);
    }

    if (idempotencyKey) {
      headers.set('Idempotency-Key', idempotencyKey);
    }

    const init: RequestInit = {
      ...fetchOptions,
      credentials: 'include',
      headers,
    };

    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const requestId = response.headers.get('X-Request-Id') ?? undefined;
    const payload = await readJson(response);

    if (!response.ok) {
      throw new ApiError(resolveApiMessage(payload, response.statusText), response.status, payload, requestId);
    }

    return payload as T;
  }

  return {
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
    request,
  };
}

export function getBrowserApiClient(): ApiClient {
  return createApiClient({ baseUrl: getWebEnv().NEXT_PUBLIC_API_BASE_URL });
}

async function readJson(response: Response): Promise<unknown> {
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

function resolveApiMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return fallback || 'Request failed';
}
