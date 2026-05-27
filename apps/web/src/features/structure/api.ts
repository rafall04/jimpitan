/**
 * Purpose: Browser API adapter for tenant-scoped Residents/Houses/Areas endpoints.
 * Caller: Structure TanStack Query hooks and mutation handlers.
 * Deps: Same-origin backend proxy, ApiError, and structure query schemas.
 * MainFuncs: Lists, reads, creates, updates, archives, reactivates, and assigns records through backend contracts.
 * SideEffects: Performs browser fetch requests with cookies and active tenant headers.
 */
import { ApiError } from '@/lib/api/api-error';
import { buildStructureQuery } from './schemas';
import type {
  AreaListParams,
  AreaRecord,
  CreateAreaPayload,
  CreateHousePayload,
  CreateResidentPayload,
  HouseListParams,
  HouseRecord,
  PaginatedResult,
  ResidentListParams,
  ResidentListRow,
  ResidentRecord,
  UpdateAreaPayload,
  UpdateHousePayload,
  UpdateResidentPayload,
} from './types';

export async function listAreas(tenantId: string, params: AreaListParams = {}): Promise<PaginatedResult<AreaRecord>> {
  return appApiJson(`/api/backend/areas${buildStructureQuery(params)}`, { tenantId });
}

export async function getArea(tenantId: string, areaId: string): Promise<AreaRecord> {
  return appApiJson(`/api/backend/areas/${areaId}`, { tenantId });
}

export async function createArea(tenantId: string, payload: CreateAreaPayload): Promise<AreaRecord> {
  return appApiJson('/api/backend/areas', { method: 'POST', tenantId, body: payload });
}

export async function updateArea(tenantId: string, areaId: string, payload: UpdateAreaPayload): Promise<AreaRecord> {
  return appApiJson(`/api/backend/areas/${areaId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function archiveArea(tenantId: string, areaId: string): Promise<AreaRecord> {
  return appApiJson(`/api/backend/areas/${areaId}/archive`, { method: 'PATCH', tenantId });
}

export async function listHouses(tenantId: string, params: HouseListParams = {}): Promise<PaginatedResult<HouseRecord>> {
  return appApiJson(`/api/backend/houses${buildStructureQuery(params)}`, { tenantId });
}

export async function getHouse(tenantId: string, houseId: string): Promise<HouseRecord> {
  return appApiJson(`/api/backend/houses/${houseId}`, { tenantId });
}

export async function createHouse(tenantId: string, payload: CreateHousePayload): Promise<HouseRecord> {
  return appApiJson('/api/backend/houses', { method: 'POST', tenantId, body: payload });
}

export async function updateHouse(tenantId: string, houseId: string, payload: UpdateHousePayload): Promise<HouseRecord> {
  return appApiJson(`/api/backend/houses/${houseId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function archiveHouse(tenantId: string, houseId: string): Promise<HouseRecord> {
  return appApiJson(`/api/backend/houses/${houseId}/archive`, { method: 'PATCH', tenantId });
}

export async function listResidents(tenantId: string, params: ResidentListParams = {}): Promise<PaginatedResult<ResidentListRow>> {
  return appApiJson(`/api/backend/residents${buildStructureQuery(params)}`, { tenantId });
}

export async function getResident(tenantId: string, residentId: string): Promise<ResidentRecord> {
  return appApiJson(`/api/backend/residents/${residentId}`, { tenantId });
}

export async function createResident(tenantId: string, payload: CreateResidentPayload): Promise<ResidentRecord> {
  return appApiJson('/api/backend/residents', { method: 'POST', tenantId, body: payload });
}

export async function updateResident(tenantId: string, residentId: string, payload: UpdateResidentPayload): Promise<ResidentRecord> {
  return appApiJson(`/api/backend/residents/${residentId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function moveResidentHouse(tenantId: string, residentId: string, houseId: string): Promise<ResidentRecord> {
  return appApiJson(`/api/backend/residents/${residentId}/house`, { method: 'PATCH', tenantId, body: { houseId } });
}

export async function archiveResident(tenantId: string, residentId: string): Promise<ResidentRecord> {
  return appApiJson(`/api/backend/residents/${residentId}/archive`, { method: 'PATCH', tenantId });
}

export async function reactivateResident(tenantId: string, residentId: string): Promise<ResidentRecord> {
  return appApiJson(`/api/backend/residents/${residentId}/reactivate`, { method: 'PATCH', tenantId });
}

async function appApiJson<T>(path: string, options: { method?: string; tenantId: string; body?: unknown }): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('X-Tenant-Id', options.tenantId);

  const init: RequestInit = {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
  };

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
