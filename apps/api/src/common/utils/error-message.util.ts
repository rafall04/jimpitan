/**
 * Purpose: Convert unknown thrown values into safe response messages.
 * Caller: Global exception filter.
 * Deps: None.
 * MainFuncs: Extracts readable error messages without leaking raw objects.
 * SideEffects: None.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  return 'Unexpected error';
}
