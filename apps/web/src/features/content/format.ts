/**
 * Purpose: Display helpers for content (image URLs, Indonesian date formatting, datetime-local conversion).
 * Caller: Content dashboard + public components and pages.
 * Deps: Frontend env parser and API URL helper.
 * MainFuncs: Builds absolute image src from a relative API path and formats dates for id-ID.
 * SideEffects: None.
 */
import { joinApiUrl } from '@/lib/api/url';
import { getWebEnv } from '@/lib/env/env';

// Image refs are returned relative to the API base; turn them into a browser-loadable absolute URL.
export function contentImageSrc(relativeUrl: string): string {
  return String(joinApiUrl(getWebEnv().NEXT_PUBLIC_API_BASE_URL, relativeUrl));
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '-';
}

export function formatDate(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(date) : '-';
}

// Value for an <input type="datetime-local"> (local wall-clock, no timezone suffix).
export function toDateTimeLocal(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
