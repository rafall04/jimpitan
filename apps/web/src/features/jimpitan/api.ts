/**
 * Purpose: Browser API adapter for tenant-scoped Jimpitan collection endpoints.
 * Caller: Jimpitan TanStack hooks and operational pages.
 * Deps: Same-origin backend proxy, ApiError, Jimpitan schemas, and response types.
 * MainFuncs: Lists sessions, reads details/checklists/summaries, runs lifecycle actions, submits item batches, and sets BULK_TOTAL totals.
 * SideEffects: Performs browser fetch requests with cookies and active tenant headers.
 */
import { ApiError } from '@/lib/api/api-error';
import { buildJimpitanQuery } from './schemas';
import type {
  CollectionChecklist,
  CollectionListParams,
  CollectionSessionRecord,
  CollectionSummary,
  CreateCollectionPayload,
  OutstandingHouseRecord,
  PaginatedResult,
  SetBulkCollectionTotalPayload,
  TenantMembershipRow,
  UpsertCollectionItemsPayload,
} from './types';

export async function listCollections(tenantId: string, params: CollectionListParams = {}, options: { mine?: boolean } = {}): Promise<PaginatedResult<CollectionSessionRecord>> {
  const path = options.mine ? '/api/backend/jimpitan/collections/mobile/my' : '/api/backend/jimpitan/collections';
  return appApiJson(`${path}${buildJimpitanQuery(params)}`, { tenantId });
}

export async function createCollection(tenantId: string, payload: CreateCollectionPayload): Promise<CollectionSessionRecord> {
  return appApiJson('/api/backend/jimpitan/collections', { method: 'POST', tenantId, body: payload });
}

export async function getCollection(tenantId: string, collectionId: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}`, { tenantId });
}

export async function startCollection(tenantId: string, collectionId: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/start`, { method: 'PATCH', tenantId });
}

export async function generateChecklist(tenantId: string, collectionId: string): Promise<CollectionChecklist> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/checklist/generate`, { method: 'POST', tenantId });
}

export async function getChecklist(tenantId: string, collectionId: string): Promise<CollectionChecklist> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/checklist`, { tenantId });
}

export async function upsertCollectionItems(tenantId: string, collectionId: string, payload: UpsertCollectionItemsPayload): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/items/batch`, { method: 'PUT', tenantId, body: payload });
}

export async function setBulkCollectionTotal(tenantId: string, collectionId: string, payload: SetBulkCollectionTotalPayload): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/bulk-total`, { method: 'PUT', tenantId, body: payload });
}

export async function submitCollection(tenantId: string, collectionId: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/submit`, { method: 'PATCH', tenantId, body: { submitRequestId: crypto.randomUUID() } });
}

export async function validateCollection(tenantId: string, collectionId: string, validationNote?: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/validate`, { method: 'PATCH', tenantId, body: { validationNote } });
}

export async function rejectCollection(tenantId: string, collectionId: string, rejectionReason: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/reject`, { method: 'PATCH', tenantId, body: { rejectionReason } });
}

export async function cancelCollection(tenantId: string, collectionId: string, cancellationReason: string): Promise<CollectionSessionRecord> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/cancel`, { method: 'PATCH', tenantId, body: { cancellationReason } });
}

export async function getCollectionSummary(tenantId: string, collectionId: string): Promise<CollectionSummary> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/summary`, { tenantId });
}

export async function getOutstandingHouses(tenantId: string, collectionId: string, params: { page?: number; limit?: number } = {}): Promise<PaginatedResult<OutstandingHouseRecord>> {
  return appApiJson(`/api/backend/jimpitan/collections/${collectionId}/outstanding${buildJimpitanQuery(params)}`, { tenantId });
}

export async function listTenantMemberships(tenantId: string): Promise<PaginatedResult<TenantMembershipRow>> {
  return appApiJson('/api/backend/users/memberships?page=1&limit=100', { tenantId });
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
  return fallback || 'Request failed.';
}
