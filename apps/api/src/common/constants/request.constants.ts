/**
 * Purpose: Request-level constants shared across middleware, filters, and decorators.
 * Caller: Common infrastructure and future controllers.
 * Deps: None.
 * MainFuncs: Defines correlation ID header and request property names.
 * SideEffects: None.
 */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_CORRELATION_ID_KEY = 'correlationId';
export const TENANT_ID_HEADER = 'x-rt-id';
