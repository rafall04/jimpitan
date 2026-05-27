/**
 * Purpose: Shared API error type for frontend network requests.
 * Caller: API client, feature forms, and mutation handlers.
 * Deps: None.
 * MainFuncs: Carries status code, response payload, and request trace metadata.
 * SideEffects: None.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;
  readonly requestId?: string;

  constructor(message: string, status: number, payload: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.requestId = requestId;
  }
}
