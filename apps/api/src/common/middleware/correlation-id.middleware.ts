/**
 * Purpose: Request middleware that ensures every API request has a correlation ID.
 * Caller: AppModule middleware configuration.
 * Deps: crypto randomUUID, Express request/response flow, request constants.
 * MainFuncs: Reads or creates correlation ID and mirrors it into the response header.
 * SideEffects: Mutates request context and response headers.
 */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import { CORRELATION_ID_HEADER } from '../constants/request.constants';
import type { RequestWithContext } from '../types/request-context.type';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: RequestWithContext, response: Response, next: NextFunction): void {
    const incoming = request.headers[CORRELATION_ID_HEADER];
    const correlationId = Array.isArray(incoming) ? incoming[0] : incoming;
    request.correlationId = correlationId || randomUUID();
    response.setHeader(CORRELATION_ID_HEADER, request.correlationId);
    next();
  }
}
