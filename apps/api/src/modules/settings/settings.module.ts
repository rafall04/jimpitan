/**
 * Purpose: NestJS module boundary for per-RT settings (public finance visibility).
 * Caller: AppModule imports; ReportsModule imports this to read the kas gate.
 * Deps: AuthModule, RbacModule, SettingsController, SettingsService, Prisma settings repository.
 * MainFuncs: Wires settings presentation, application, and persistence providers; exports SettingsService.
 * SideEffects: Provides SettingsService through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { SETTINGS_REPOSITORY } from './settings.tokens';
import { SettingsService } from './application/settings.service';
import { PrismaSettingsRepository } from './infrastructure/prisma-settings.repository';
import { SettingsController } from './presentation/settings.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [SettingsController],
  providers: [SettingsService, PrismaSettingsRepository, { provide: SETTINGS_REPOSITORY, useExisting: PrismaSettingsRepository }],
  exports: [SettingsService],
})
export class SettingsModule {}
