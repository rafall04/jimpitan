/**
 * Purpose: Controller decorator for reading the current request correlation ID.
 * Caller: Future controllers that need request trace metadata.
 * Deps: NestJS createParamDecorator, RequestWithContext type.
 * MainFuncs: Extracts correlation ID from the request context.
 * SideEffects: None.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithContext } from '../types/request-context.type';

export const CorrelationId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithContext>();
  return request.correlationId;
});
