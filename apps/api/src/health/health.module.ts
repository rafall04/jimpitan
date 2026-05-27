/**
 * Purpose: NestJS module for infrastructure health endpoints.
 * Caller: AppModule imports during API startup.
 * Deps: HealthController.
 * MainFuncs: Registers health-check controller.
 * SideEffects: Exposes health route through the HTTP server.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
