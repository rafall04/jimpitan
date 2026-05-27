/**
 * Purpose: Controller decorator for tenant/RT context.
 * Caller: Tenant-scoped controllers and guards.
 * Deps: NestJS createParamDecorator, RequestWithContext type.
 * MainFuncs: Reads resolved RT tenant ID from request context.
 * SideEffects: None.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithContext } from '../types/request-context.type';

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return request.user?.rtId ?? request.tenantId;
});
