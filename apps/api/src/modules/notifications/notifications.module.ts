/**
 * Purpose: NestJS module boundary for tenant-scoped notifications, inbox reads, delivery outbox, and provider hook foundations.
 * Caller: AppModule imports, notification route wiring, and business workflow adapters.
 * Deps: AuthModule, RbacModule, NotificationsController, NotificationsService, Prisma repository, and no-op delivery hook adapters.
 * MainFuncs: Registers notification presentation, application, persistence, Telegram hook, email hook, and repository provider bindings.
 * SideEffects: Provides notification services and hook bindings through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { EMAIL_NOTIFICATION_DELIVERY, NOTIFICATIONS_REPOSITORY, TELEGRAM_NOTIFICATION_DELIVERY } from './notifications.tokens';
import { NotificationsService } from './application/notifications.service';
import { NoopEmailNotificationDelivery, NoopTelegramNotificationDelivery } from './infrastructure/noop-notification-delivery';
import { PrismaNotificationsRepository } from './infrastructure/prisma-notifications.repository';
import { NotificationsController } from './presentation/notifications.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PrismaNotificationsRepository,
    NoopTelegramNotificationDelivery,
    NoopEmailNotificationDelivery,
    { provide: NOTIFICATIONS_REPOSITORY, useExisting: PrismaNotificationsRepository },
    { provide: TELEGRAM_NOTIFICATION_DELIVERY, useExisting: NoopTelegramNotificationDelivery },
    { provide: EMAIL_NOTIFICATION_DELIVERY, useExisting: NoopEmailNotificationDelivery },
  ],
  exports: [NotificationsService, TELEGRAM_NOTIFICATION_DELIVERY, EMAIL_NOTIFICATION_DELIVERY],
})
export class NotificationsModule {}
