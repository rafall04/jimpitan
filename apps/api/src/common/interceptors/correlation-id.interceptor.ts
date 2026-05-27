/**
 * Purpose: Interceptor boundary for future request tracing extensions.
 * Caller: Future module or global interceptor registration.
 * Deps: NestJS interceptor interfaces, RxJS Observable.
 * MainFuncs: Passes requests through while preserving a stable tracing extension point.
 * SideEffects: None.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }
}
