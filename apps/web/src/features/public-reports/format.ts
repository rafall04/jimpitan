/**
 * Purpose: Public transparency formatting and safe route parameter helpers.
 * Caller: Public routes, API helpers, components, and tests.
 * Deps: Intl date/number formatters and URLSearchParams.
 * MainFuncs: Formats IDR/dates/months, sanitizes public route filters, builds month windows, and redacts phone-like copy.
 * SideEffects: None.
 */
const RT_CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const PHONE_LIKE_PATTERN = /(?:\+?62|0)\d[\d\s.-]{7,}\d/g;
type SearchValue = string | string[] | undefined;
export type PublicSearchParams = Record<string, SearchValue> | undefined;

export type ResolvedPublicReportParams = {
  rtCode?: string;
  month: string;
  search: string;
};

export function formatIdr(value: string | number): string {
  const numeric = Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
    .format(safeNumber)
    .replace(/\s+/g, '');
}

export function formatIndonesianDate(value: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatIndonesianMonth(month: string): string {
  const [year, rawMonth] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, rawMonth - 1, 1)));
}

export function sanitizePublicCopy(value: string): string {
  return value.replace(PHONE_LIKE_PATTERN, '[nomor disembunyikan]');
}

export function resolvePublicReportParams(params: PublicSearchParams, options: { defaultRtCode?: string; now?: Date } = {}): ResolvedPublicReportParams {
  const now = options.now ?? new Date();
  const defaultRtCode = safeRtCode(options.defaultRtCode ?? publicDefaultRtCode());
  const rtCode = safeRtCode(firstParam(params?.rt)) ?? defaultRtCode;
  const fallbackMonth = toMonth(now);
  const month = safeMonth(firstParam(params?.month)) ?? fallbackMonth;
  const search = safeSearch(firstParam(params?.search));

  return { rtCode, month, search };
}

export function publicDefaultRtCode(): string | undefined {
  return process.env.NEXT_PUBLIC_PUBLIC_RT_CODE ?? process.env.NEXT_PUBLIC_RT_CODE;
}

export function buildRecentMonths(endMonth: string, count: number): string[] {
  const safeCount = Math.max(1, Math.min(count, 12));
  const [year, rawMonth] = endMonth.split('-').map(Number);
  const end = new Date(Date.UTC(year, rawMonth - 1, 1));
  return Array.from({ length: safeCount }, (_, index) => {
    const offset = safeCount - index - 1;
    return toMonth(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1)));
  });
}

export function publicReportHref(path: string, rtCode: string, params: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  search.set('rt', rtCode);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  return `${path}?${search.toString()}`;
}

function firstParam(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeRtCode(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && RT_CODE_PATTERN.test(trimmed) ? trimmed : undefined;
}

function safeMonth(value: string | undefined): string | undefined {
  if (!value || !MONTH_PATTERN.test(value)) {
    return undefined;
  }
  const [year, month] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, 1));
  return month >= 1 && month <= 12 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 ? value : undefined;
}

function safeSearch(value: string | undefined): string {
  return value?.trim().slice(0, 80) ?? '';
}

function toMonth(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}
