/**
 * Purpose: Root NestJS module wiring for the JIMPITAN backend.
 * Caller: NestFactory during API bootstrap.
 * Deps: Config, Prisma, common middleware, health, and domain module skeletons.
 * MainFuncs: Imports all backend module boundaries, registers the global authentication/tenant/permission guard chain, and applies request correlation middleware.
 * SideEffects: Registers module providers and middleware in the NestJS container.
 */
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { ContentModule } from './modules/content/content.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuthenticationGuard } from './common/guards/authentication.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { PermissionGuard } from './common/guards/permission.guard';

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
    ContentModule,
    SettingsModule,
  ],
  providers: [
    // Global guard chain — runs in this order for every route. Routes opt out of auth with
    // @PublicRoute(); cross-tenant admin routes opt out of tenant scoping with @SkipTenantGuard().
    // Registering globally makes auth fail-closed: a new controller is protected by default.
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
