/**
 * Purpose: NestJS module boundary for jimpitan collection workflows.
 * Caller: AppModule imports and jimpitan collection route wiring.
 * Deps: AuthModule, RbacModule, FinanceModule, NotificationsModule, JimpitanController, JimpitanService, Prisma repository, finance hooks, and notification hooks.
 * MainFuncs: Registers collection presentation, application, persistence, and decoupled composite workflow hook providers.
 * SideEffects: Provides jimpitan repository and hook bindings through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { JIMPITAN_HOOKS, JIMPITAN_REPOSITORY } from './jimpitan.tokens';
import { JimpitanService } from './application/jimpitan.service';
import { CompositeJimpitanHooks } from './infrastructure/composite-jimpitan.hooks';
import { JimpitanNotificationHooks } from './infrastructure/jimpitan-notification.hooks';
import { PrismaJimpitanRepository } from './infrastructure/prisma-jimpitan.repository';
import { JimpitanController } from './presentation/jimpitan.controller';

@Module({
  imports: [AuthModule, RbacModule, FinanceModule, NotificationsModule],
  controllers: [JimpitanController],
  providers: [
    JimpitanService,
    PrismaJimpitanRepository,
    JimpitanNotificationHooks,
    CompositeJimpitanHooks,
    { provide: JIMPITAN_REPOSITORY, useExisting: PrismaJimpitanRepository },
    { provide: JIMPITAN_HOOKS, useExisting: CompositeJimpitanHooks },
  ],
  exports: [JimpitanService],
})
export class JimpitanModule {}
