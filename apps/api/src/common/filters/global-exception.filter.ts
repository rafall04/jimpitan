/**
 * Purpose: Global HTTP exception filter for consistent API error responses.
 * Caller: main.ts global filter registration.
 * Deps: NestJS exception APIs, Express response, request context type.
 * MainFuncs: Maps thrown errors into a stable error envelope with correlation ID.
 * SideEffects: Writes HTTP error responses.
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithContext } from '../types/request-context.type';
import { getErrorMessage } from '../utils/error-message.util';

type ErrorResponseBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithContext>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = this.toErrorBody(exception, exceptionResponse, request.correlationId);

    response.status(status).json(body);
  }

  private toErrorBody(exception: unknown, exceptionResponse: unknown, requestId?: string): ErrorResponseBody {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const responseRecord = exceptionResponse as Record<string, unknown>;
      return {
        error: {
          code: typeof responseRecord.error === 'string' ? responseRecord.error : 'HTTP_ERROR',
          message: typeof responseRecord.message === 'string' ? responseRecord.message : getErrorMessage(exception),
          details: responseRecord.message,
          requestId,
        },
      };
    }

    return {
      error: {
        code: exception instanceof HttpException ? 'HTTP_ERROR' : 'INTERNAL_SERVER_ERROR',
        message: getErrorMessage(exception),
        requestId,
      },
    };
  }
}
