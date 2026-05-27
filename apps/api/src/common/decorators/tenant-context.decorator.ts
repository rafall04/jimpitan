/**
 * Purpose: Controller decorator for the resolved tenant membership context.
 * Caller: Tenant-scoped controllers after AuthenticationGuard/TenantGuard resolution.
 * Deps: NestJS createParamDecorator, RequestWithContext type.
 * MainFuncs: Reads RT ID and membership ID from the authenticated request principal.
 * SideEffects: None.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithContext } from '../types/request-context.type';

export type TenantContext = {
  rtId?: string;
  membershipId?: string;
};

export const TenantContext = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return {
    rtId: request.user?.rtId ?? request.tenantId,
    membershipId: request.user?.membershipId,
  };
});
