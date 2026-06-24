/**
 * Purpose: Safe user-facing error formatter for Jimpitan operational mutations.
 * Caller: Jimpitan pages and mobile flow.
 * Deps: ApiError.
 * MainFuncs: Preserves backend validation messages while hiding unexpected server internals.
 * SideEffects: None.
 */
import { ApiError } from '@/lib/api/api-error';

export function toUserMessage(error: unknown, fallback = 'Tindakan gagal. Coba lagi.'): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  return error.status >= 500 ? fallback : error.message;
}
