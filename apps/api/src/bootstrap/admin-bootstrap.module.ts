/**
 * Purpose: NestJS application-context module for the first-admin bootstrap command.
 * Caller: apps/api/src/bootstrap/admin.ts.
 * Deps: AppConfigModule, PrismaModule, AuthModule, and AdminBootstrapService.
 * MainFuncs: Provides database access and the same Auth password hasher used by login flows.
 * SideEffects: Registers providers for a one-shot CLI application context.
 */
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../modules/auth/auth.module';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  imports: [AppConfigModule, PrismaModule, AuthModule],
  providers: [AdminBootstrapService],
})
export class AdminBootstrapModule {}
