/**
 * Purpose: Request type extensions for correlation, auth principal, and tenant context.
 * Caller: Middleware, decorators, guards, filters, and controllers.
 * Deps: Express Request type.
 * MainFuncs: Provides typed access to request-scoped metadata.
 * SideEffects: None.
 */
import type { Request } from 'express';
import type { AuthPrincipal } from '../../modules/auth/domain/auth.types';

export type RequestWithContext = Request & {
  correlationId?: string;
  tenantId?: string;
  user?: AuthPrincipal;
};
