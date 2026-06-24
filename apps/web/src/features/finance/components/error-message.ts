/**
 * Purpose: Safe user-facing error formatter for finance and approval mutations.
 * Caller: Finance and approval pages.
 * Deps: ApiError.
 * MainFuncs: Preserves backend validation/rejection messages while hiding unexpected server internals.
 * SideEffects: None.
 */
import { ApiError } from '@/lib/api/api-error';

export function toUserMessage(error: unknown, fallback = 'Tindakan gagal. Silakan coba lagi.'): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  return error.status >= 500 ? fallback : error.message;
}
