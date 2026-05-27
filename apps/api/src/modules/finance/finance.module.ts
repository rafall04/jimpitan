/**
 * Purpose: NestJS module boundary for finance cash accounts, transactions, categories, ledger posting orchestration, collection posting hooks, and transaction-posted notification hooks.
 * Caller: AppModule imports and future finance route wiring.
 * Deps: AuthModule, RbacModule, NotificationsModule, finance controllers, finance services, and hook adapter scaffold.
 * MainFuncs: Registers finance presentation, application, decoupled collection hook scaffolds, optional notification hook integration, and bot-facing finance services.
 * SideEffects: Provides finance services and hook adapter through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RbacModule } from '../rbac/rbac.module';
import { FINANCE_REPOSITORY } from './finance.tokens';
import { CashAccountsService } from './application/cash-accounts.service';
import { FinanceService } from './application/finance.service';
import { FinanceTransactionsService } from './application/finance-transactions.service';
import { TransactionCategoriesService } from './application/transaction-categories.service';
import { JimpitanFinanceHooks } from './infrastructure/jimpitan-finance.hooks';
import { PrismaFinanceRepository } from './infrastructure/prisma-finance.repository';
import { CashAccountsController } from './presentation/cash-accounts.controller';
import { FinanceController } from './presentation/finance.controller';
import { FinanceTransactionsController } from './presentation/finance-transactions.controller';
import { TransactionCategoriesController } from './presentation/transaction-categories.controller';

@Module({
  imports: [AuthModule, RbacModule, NotificationsModule],
  controllers: [FinanceController, CashAccountsController, TransactionCategoriesController, FinanceTransactionsController],
  providers: [
    FinanceService,
    CashAccountsService,
    TransactionCategoriesService,
    FinanceTransactionsService,
    JimpitanFinanceHooks,
    PrismaFinanceRepository,
    { provide: FINANCE_REPOSITORY, useExisting: PrismaFinanceRepository },
  ],
  exports: [CashAccountsService, TransactionCategoriesService, FinanceTransactionsService, JimpitanFinanceHooks],
})
export class FinanceModule {}
