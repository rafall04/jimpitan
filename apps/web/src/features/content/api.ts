/**
 * Purpose: Browser API adapter for tenant-scoped content authoring + image endpoints.
 * Caller: Content TanStack Query hooks and forms.
 * Deps: Same-origin backend proxy (/api/backend/content), ApiError, content query builder + types.
 * MainFuncs: Lists/reads/creates/updates/publishes/archives/deletes posts and uploads/removes cover + gallery images.
 * SideEffects: Performs browser fetch requests with cookies and active tenant headers (multipart for uploads).
 */
import { ApiError } from '@/lib/api/api-error';
import { buildContentQuery } from './schemas';
import type {
  ContentImageRef,
  ContentListParams,
  ContentListRow,
  ContentPostRecord,
  CreateContentPayload,
  PaginatedResult,
  UpdateContentPayload,
} from './types';

const BASE = '/api/backend/content';

export async function listContent(tenantId: string, params: ContentListParams = {}): Promise<PaginatedResult<ContentListRow>> {
  return appApiJson(`${BASE}${buildContentQuery(params)}`, { tenantId });
}

export async function getContent(tenantId: string, postId: string): Promise<ContentPostRecord> {
  return appApiJson(`${BASE}/${postId}`, { tenantId });
}

export async function createContent(tenantId: string, payload: CreateContentPayload): Promise<ContentPostRecord> {
  return appApiJson(BASE, { method: 'POST', tenantId, body: payload });
}

export async function updateContent(tenantId: string, postId: string, payload: UpdateContentPayload): Promise<ContentPostRecord> {
  return appApiJson(`${BASE}/${postId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function publishContent(tenantId: string, postId: string): Promise<ContentPostRecord> {
  return appApiJson(`${BASE}/${postId}/publish`, { method: 'POST', tenantId });
}

export async function archiveContent(tenantId: string, postId: string): Promise<ContentPostRecord> {
  return appApiJson(`${BASE}/${postId}/archive`, { method: 'POST', tenantId });
}

export async function deleteContent(tenantId: string, postId: string): Promise<{ deleted: boolean }> {
  return appApiJson(`${BASE}/${postId}`, { method: 'DELETE', tenantId });
}

export async function listContentImages(tenantId: string, postId: string): Promise<ContentImageRef[]> {
  return appApiJson(`${BASE}/${postId}/images`, { tenantId });
}

export async function uploadContentCover(tenantId: string, postId: string, file: File): Promise<ContentImageRef> {
  return uploadImage(`${BASE}/${postId}/cover`, tenantId, file);
}

export async function uploadContentGalleryImage(tenantId: string, postId: string, file: File): Promise<ContentImageRef> {
  return uploadImage(`${BASE}/${postId}/images`, tenantId, file);
}

export async function removeContentImage(tenantId: string, postId: string, attachmentId: string): Promise<{ deleted: boolean }> {
  return appApiJson(`${BASE}/${postId}/images/${attachmentId}`, { method: 'DELETE', tenantId });
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

  return readResponse<T>(await fetch(path, init));
}

async function uploadImage(path: string, tenantId: string, file: File): Promise<ContentImageRef> {
  const form = new FormData();
  form.append('file', file);
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Tenant-Id', tenantId);
  // Do NOT set Content-Type — the browser adds the multipart/form-data boundary.
  return readResponse<ContentImageRef>(await fetch(path, { method: 'POST', credentials: 'include', headers, body: form }));
}

async function readResponse<T>(response: Response): Promise<T> {
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new ApiError(resolveMessage(payload, response.statusText), response.status, payload, requestId);
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
    return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback;
  }
  return fallback || 'Permintaan gagal.';
}
