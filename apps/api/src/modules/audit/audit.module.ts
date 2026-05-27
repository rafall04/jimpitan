/**
 * Purpose: NestJS module boundary for audit logs.
 * Caller: AppModule imports and future audit route wiring.
 * Deps: AuditController, AuditService.
 * MainFuncs: Registers audit presentation and application skeletons.
 * SideEffects: None.
 */
import { Module } from '@nestjs/common';
import { AuditService } from './application/audit.service';
import { AuditController } from './presentation/audit.controller';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
