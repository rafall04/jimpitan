/**
 * Purpose: Controller decorator for authenticated principal context.
 * Caller: Private controllers after AuthenticationGuard resolution.
 * Deps: NestJS createParamDecorator, RequestWithContext type.
 * MainFuncs: Reads the full principal or a selected principal field from request context.
 * SideEffects: None.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthPrincipal } from '../../modules/auth/domain/auth.types';
import type { RequestWithContext } from '../types/request-context.type';

export const CurrentUser = createParamDecorator((data: keyof AuthPrincipal | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  if (!data) {
    return request.user;
  }

  return request.user?.[data];
});
