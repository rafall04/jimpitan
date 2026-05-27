/**
 * Purpose: NestJS dependency boundary for the background worker process.
 * Caller: worker/main.ts application-context bootstrap.
 * Deps: Config, Prisma, Reports, Notifications, Telegram modules, and WorkerService.
 * MainFuncs: Registers queue processing dependencies without HTTP controllers.
 * SideEffects: Initializes imported module providers when the worker starts.
 */
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { ReportsModule } from '../modules/reports/reports.module';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkerService } from './worker.service';

@Module({
  imports: [AppConfigModule, PrismaModule, ReportsModule, NotificationsModule, TelegramModule],
  providers: [WorkerService],
})
export class WorkerModule {}
