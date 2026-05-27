/**
 * Purpose: Unauthenticated API adapter for public transparency endpoints.
 * Caller: Public report routes and tests.
 * Deps: API URL helper, frontend env validation, ApiError, and public report contracts.
 * MainFuncs: Fetches public summary/monthly/feed data, builds public CSV export links, enforces no-auth requests, and rejects private-shaped payloads.
 * SideEffects: Performs public backend fetch requests without cookies or tenant headers.
 */
import { ApiError } from '@/lib/api/api-error';
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';
import { sanitizePublicCopy } from './format';
import type { PublicAnnouncement, PublicFeedParams, PublicMonthlyFinanceReport, PublicPaginatedResult, PublicReportMetadata, PublicTransparencySummary } from './types';

type PublicApiOptions = {
  baseUrl?: string;
  fetcher?: typeof fetch;
};

const PRIVATE_FIELD_PATTERNS = [
  /phone/i,
  /whatsapp/i,
  /resident/i,
  /audit/i,
  /approval/i,
  /internal/i,
  /note/i,
  /ledger(?:row|entry|sequence|id)/i,
  /cashAccountId/i,
  /account(?:Id|Key|Name)/i,
  /createdBy/i,
  /updatedBy/i,
  /requestedBy/i,
  /membership/i,
  /member/i,
  /permission/i,
  /role/i,
  /session/i,
  /token/i,
  /telegram/i,
  /house/i,
  /nik/i,
  /alamat/i,
  /address/i,
];

export async function getPublicSummary(rtCode: string, options: PublicApiOptions = {}): Promise<PublicTransparencySummary> {
  return publicApiJson<PublicTransparencySummary>(`reports/public/${encodeURIComponent(rtCode)}/summary`, options);
}

export async function getPublicMonthlyFinance(rtCode: string, month: string, options: PublicApiOptions = {}): Promise<PublicMonthlyFinanceReport> {
  const query = new URLSearchParams({ month });
  return publicApiJson<PublicMonthlyFinanceReport>(`reports/public/${encodeURIComponent(rtCode)}/monthly-finance?${query.toString()}`, options);
}

export async function listPublicReportMetadata(rtCode: string, params: PublicFeedParams = {}, options: PublicApiOptions = {}): Promise<PublicPaginatedResult<PublicReportMetadata>> {
  return publicApiJson<PublicPaginatedResult<PublicReportMetadata>>(`reports/public/${encodeURIComponent(rtCode)}/metadata${buildFeedQuery(params)}`, options);
}

export async function listPublicAnnouncements(rtCode: string, params: PublicFeedParams = {}, options: PublicApiOptions = {}): Promise<PublicPaginatedResult<PublicAnnouncement>> {
  return publicApiJson<PublicPaginatedResult<PublicAnnouncement>>(`reports/public/${encodeURIComponent(rtCode)}/announcements${buildFeedQuery(params)}`, options);
}

export async function getPublicMonthlyTrend(rtCode: string, months: string[], options: PublicApiOptions = {}): Promise<PublicMonthlyFinanceReport[]> {
  return Promise.all(months.map((month) => getPublicMonthlyFinance(rtCode, month, options)));
}

export function publicSummaryCsvHref(rtCode: string, options: Pick<PublicApiOptions, 'baseUrl'> = {}): string {
  return publicExportHref(`reports/public/${encodeURIComponent(rtCode)}/exports/summary.csv`, undefined, options);
}

export function publicMonthlyFinanceCsvHref(rtCode: string, month: string, options: Pick<PublicApiOptions, 'baseUrl'> = {}): string {
  return publicExportHref(`reports/public/${encodeURIComponent(rtCode)}/exports/monthly-finance.csv`, new URLSearchParams({ month }), options);
}

export function publicCollectionsCsvHref(rtCode: string, month: string, options: Pick<PublicApiOptions, 'baseUrl'> = {}): string {
  return publicExportHref(`reports/public/${encodeURIComponent(rtCode)}/exports/collections.csv`, new URLSearchParams({ month }), options);
}

export function assertPublicPayloadSafety(payload: unknown): void {
  inspectPublicPayload(payload, '$');
}

function buildFeedQuery(params: PublicFeedParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }
  if (params.search) {
    query.set('search', params.search);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function publicApiJson<T>(path: string, options: PublicApiOptions): Promise<T> {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl ?? getWebEnv().NEXT_PUBLIC_API_BASE_URL;
  const headers = new Headers();
  headers.set('Accept', 'application/json');

  const response = await fetcher(joinApiUrl(baseUrl, path), {
    method: 'GET',
    headers,
    credentials: 'omit',
    cache: 'no-store',
  });
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError('Laporan publik belum dapat dimuat.', response.status, payload, requestId);
  }

  assertPublicPayloadSafety(payload);
  return sanitizePublicPayload(payload) as T;
}

function publicExportHref(path: string, query: URLSearchParams | undefined, options: Pick<PublicApiOptions, 'baseUrl'>): string {
  const baseUrl = options.baseUrl ?? getWebEnv().NEXT_PUBLIC_API_BASE_URL;
  return String(joinApiUrl(baseUrl, `${path}${query ? `?${query.toString()}` : ''}`));
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

function inspectPublicPayload(value: unknown, path: string): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectPublicPayload(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_FIELD_PATTERNS.some((pattern) => pattern.test(key))) {
      throw new Error(`Public payload contains private field at ${path}.${key}.`);
    }
    inspectPublicPayload(nested, `${path}.${key}`);
  }
}

function sanitizePublicPayload(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizePublicCopy(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePublicPayload(item));
  }
  if (value === null || value === undefined || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizePublicPayload(nested)]));
}
