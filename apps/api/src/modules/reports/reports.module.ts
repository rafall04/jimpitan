/**
 * Purpose: NestJS module boundary for reports, public transparency reads, and export request foundation.
 * Caller: AppModule imports and report route wiring.
 * Deps: AuthModule, RbacModule, ReportsController, ReportsService, PrismaReportsRepository, and report repository token.
 * MainFuncs: Registers report presentation, application, private/public reporting persistence, and export queue foundation.
 * SideEffects: Provides report services and repository adapter through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { REPORTS_REPOSITORY } from './reports.tokens';
import { ReportsService } from './application/reports.service';
import { PrismaReportsRepository } from './infrastructure/prisma-reports.repository';
import { ReportsController } from './presentation/reports.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [ReportsController],
  providers: [ReportsService, PrismaReportsRepository, { provide: REPORTS_REPOSITORY, useExisting: PrismaReportsRepository }],
  exports: [ReportsService],
})
export class ReportsModule {}
