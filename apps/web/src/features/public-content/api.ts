/**
 * Purpose: Unauthenticated API adapter for the public content feed, detail, and reactions.
 * Caller: Public content pages (server fetch) and the reaction bar (client POST).
 * Deps: API URL helper, frontend env, ApiError, content type maps + public content contracts.
 * MainFuncs: Lists public posts, reads a post by type+slug, records reactions, and maps URL segments to types.
 * SideEffects: Performs public backend fetches with credentials omitted.
 */
import { ApiError } from '@/lib/api/api-error';
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';
import type {
  ContentType,
  PublicContentDetail,
  PublicContentItem,
  PublicContentListParams,
  PublicDesaOverview,
  PublicPaginatedResult,
  ReactionResult,
  ReactionType,
} from './types';

export const PUBLIC_CONTENT_TYPES: { path: string; type: ContentType; label: string; blurb: string }[] = [
  { path: 'kegiatan', type: 'ACTIVITY', label: 'Kegiatan', blurb: 'Agenda & dokumentasi acara warga' },
  { path: 'pengumuman', type: 'ANNOUNCEMENT', label: 'Pengumuman', blurb: 'Info penting dari pengurus RT' },
  { path: 'artikel', type: 'ARTICLE', label: 'Artikel', blurb: 'Cerita & berita seputar RT' },
  { path: 'galeri', type: 'GALLERY', label: 'Galeri', blurb: 'Kumpulan foto kegiatan' },
];

export function contentTypeFromPath(path: string): ContentType | null {
  return PUBLIC_CONTENT_TYPES.find((entry) => entry.path === path)?.type ?? null;
}

export function publicContentTypeLabel(path: string): string {
  return PUBLIC_CONTENT_TYPES.find((entry) => entry.path === path)?.label ?? 'Konten';
}

// Image refs are returned relative to the API base; resolve to a browser-loadable absolute URL.
export function publicContentImageSrc(relativeUrl: string): string {
  return String(joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, relativeUrl));
}

export async function getPublicDesaOverview(): Promise<PublicDesaOverview> {
  return publicGet('content/public/overview');
}

export async function listPublicContent(rtCode: string, params: PublicContentListParams = {}): Promise<PublicPaginatedResult<PublicContentItem>> {
  return publicGet(`content/public/${encodeURIComponent(rtCode)}/posts${buildQuery(params)}`);
}

export async function getPublicContent(rtCode: string, typePath: string, slug: string): Promise<PublicContentDetail> {
  return publicGet(`content/public/${encodeURIComponent(rtCode)}/posts/${encodeURIComponent(typePath)}/${encodeURIComponent(slug)}`);
}

export async function reactToPublicContent(rtCode: string, typePath: string, slug: string, reactionType: ReactionType): Promise<ReactionResult> {
  return publicSend(`content/public/${encodeURIComponent(rtCode)}/posts/${encodeURIComponent(typePath)}/${encodeURIComponent(slug)}/reactions`, { reactionType });
}

function buildQuery(params: PublicContentListParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.type) query.set('type', params.type);
  if (params.search) query.set('search', params.search);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

async function publicGet<T>(path: string): Promise<T> {
  const response = await fetch(joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, path), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
  });
  return readPublic<T>(response);
}

async function publicSend<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, path), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify(body),
  });
  return readPublic<T>(response);
}

async function readPublic<T>(response: Response): Promise<T> {
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new ApiError('Konten publik belum dapat dimuat.', response.status, payload, requestId);
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
