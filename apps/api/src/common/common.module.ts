/**
 * Purpose: Shared NestJS common module for cross-cutting backend infrastructure.
 * Caller: AppModule imports and future feature modules.
 * Deps: Common decorators, interceptors, filters, pipes, constants, types, and utils.
 * MainFuncs: Establishes shared platform providers that do not depend on feature modules.
 * SideEffects: None.
 */
import { Module } from '@nestjs/common';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';

@Module({
  providers: [CorrelationIdInterceptor],
  exports: [CorrelationIdInterceptor],
})
export class CommonModule {}
