/**
 * Purpose: Safe error message formatter for structure feature mutations and queries.
 * Caller: Residents, Houses, and Areas pages.
 * Deps: Shared ApiError type.
 * MainFuncs: Converts unknown errors into short user-facing messages without exposing internals.
 * SideEffects: None.
 */
import { ApiError } from '@/lib/api/api-error';

export function toUserMessage(error: unknown, fallback = 'Tindakan gagal. Coba lagi.'): string {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  return error.status >= 500 ? fallback : error.message;
}
