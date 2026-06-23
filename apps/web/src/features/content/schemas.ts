/**
 * Purpose: Content form validation, display constants, and query serialization.
 * Caller: Content forms, list filters, pages, and public type mapping.
 * Deps: zod, content types.
 * MainFuncs: Defines the create/edit zod schema, type/status/reaction labels, and the list query builder.
 * SideEffects: None.
 */
import { z } from 'zod';
import type { ContentListParams, ContentStatus, ContentType, CreateContentPayload, ReactionType, UpdateContentPayload } from './types';

export const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string; path: string; helper: string }[] = [
  { value: 'ANNOUNCEMENT', label: 'Pengumuman', path: 'pengumuman', helper: 'Info singkat untuk warga' },
  { value: 'ACTIVITY', label: 'Kegiatan', path: 'kegiatan', helper: 'Acara dengan tanggal & lokasi' },
  { value: 'ARTICLE', label: 'Artikel', path: 'artikel', helper: 'Tulisan/berita gaya blog' },
  { value: 'GALLERY', label: 'Galeri', path: 'galeri', helper: 'Album foto kegiatan' },
];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  ANNOUNCEMENT: 'Pengumuman',
  ACTIVITY: 'Kegiatan',
  ARTICLE: 'Artikel',
  GALLERY: 'Galeri',
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Draf',
  PUBLISHED: 'Terbit',
  ARCHIVED: 'Arsip',
};

export const REACTION_OPTIONS: { value: ReactionType; label: string; emoji: string }[] = [
  { value: 'LIKE', label: 'Suka', emoji: '👍' },
  { value: 'LOVE', label: 'Suka sekali', emoji: '❤️' },
  { value: 'SUPPORT', label: 'Semangat', emoji: '🙌' },
];

export function contentTypePath(type: ContentType): string {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === type)?.path ?? 'pengumuman';
}

export const contentFormSchema = z
  .object({
    type: z.enum(['ANNOUNCEMENT', 'ACTIVITY', 'ARTICLE', 'GALLERY']),
    title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(180, 'Judul maksimal 180 karakter'),
    body: z.string().trim().min(1, 'Isi konten tidak boleh kosong'),
    excerpt: z.string().trim().max(300, 'Ringkasan maksimal 300 karakter').optional(),
    visibility: z.enum(['PUBLIC', 'MEMBERS']),
    eventStartAt: z.string().optional(),
    eventEndAt: z.string().optional(),
    location: z.string().trim().max(200, 'Lokasi maksimal 200 karakter').optional(),
  })
  .refine(
    (values) => !values.eventStartAt || !values.eventEndAt || new Date(values.eventEndAt) >= new Date(values.eventStartAt),
    { path: ['eventEndAt'], message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' },
  );

export type ContentFormValues = z.infer<typeof contentFormSchema>;

export function buildContentQuery(params: ContentListParams): string {
  const query = new URLSearchParams();
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.type) query.set('type', params.type);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

// Convert an HTML datetime-local value (no timezone) into a full ISO-8601 string the backend accepts.
export function toIsoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function toCreateContentPayload(values: ContentFormValues, publish: boolean): CreateContentPayload {
  const isActivity = values.type === 'ACTIVITY';
  return {
    type: values.type,
    title: values.title,
    body: values.body,
    excerpt: values.excerpt || undefined,
    visibility: values.visibility,
    eventStartAt: isActivity ? toIsoOrUndefined(values.eventStartAt) : undefined,
    eventEndAt: isActivity ? toIsoOrUndefined(values.eventEndAt) : undefined,
    location: isActivity ? values.location || undefined : undefined,
    publish,
  };
}

export function toUpdateContentPayload(values: ContentFormValues): UpdateContentPayload {
  const isActivity = values.type === 'ACTIVITY';
  return {
    title: values.title,
    body: values.body,
    excerpt: values.excerpt ? values.excerpt : null,
    visibility: values.visibility,
    eventStartAt: isActivity ? (toIsoOrUndefined(values.eventStartAt) ?? null) : null,
    eventEndAt: isActivity ? (toIsoOrUndefined(values.eventEndAt) ?? null) : null,
    location: isActivity ? (values.location ? values.location : null) : null,
  };
}
