/**
 * Purpose: NestJS module boundary for expense approval workflows.
 * Caller: AppModule imports and approval route wiring.
 * Deps: AuthModule, RbacModule, NotificationsModule, ApprovalsController, ApprovalsService, Prisma repository, and notification hook adapter.
 * MainFuncs: Registers approval presentation, application, persistence, and decoupled notification hook providers.
 * SideEffects: Provides approval services and repository bindings through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { APPROVAL_NOTIFICATION_HOOKS, APPROVALS_REPOSITORY } from './approvals.tokens';
import { ApprovalsService } from './application/approvals.service';
import { ApprovalNotificationAdapter } from './infrastructure/approval-notification.adapter';
import { PrismaApprovalsRepository } from './infrastructure/prisma-approvals.repository';
import { ApprovalsController } from './presentation/approvals.controller';

@Module({
  imports: [AuthModule, RbacModule, NotificationsModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalsService,
    PrismaApprovalsRepository,
    ApprovalNotificationAdapter,
    { provide: APPROVALS_REPOSITORY, useExisting: PrismaApprovalsRepository },
    { provide: APPROVAL_NOTIFICATION_HOOKS, useExisting: ApprovalNotificationAdapter },
  ],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
