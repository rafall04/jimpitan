/**
 * Purpose: Root NestJS module wiring for the JIMPITAN backend.
 * Caller: NestFactory during API bootstrap.
 * Deps: Config, Prisma, common middleware, health, and domain module skeletons.
 * MainFuncs: Imports all backend module boundaries and applies request correlation middleware.
 * SideEffects: Registers module providers and middleware in the NestJS container.
 */
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { CommonModule } from './common/common.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { ResidentsModule } from './modules/residents/residents.module';
import { HousesModule } from './modules/houses/houses.module';
import { JimpitanModule } from './modules/jimpitan/jimpitan.module';
import { FinanceModule } from './modules/finance/finance.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { AuditModule } from './modules/audit/audit.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    RbacModule,
    UsersModule,
    TenantsModule,
    ResidentsModule,
    HousesModule,
    JimpitanModule,
    FinanceModule,
    LedgerModule,
    ApprovalsModule,
    ReportsModule,
    NotificationsModule,
    TelegramModule,
    AuditModule,
    AttachmentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
