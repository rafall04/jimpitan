/**
 * Purpose: NestJS module boundary for Telegram bot webhook, binding, command routing, state, and outbox delivery.
 * Caller: AppModule imports, Telegram webhook route wiring, and notification worker execution.
 * Deps: Auth, RBAC, Jimpitan, Finance, Approvals, TelegramController, TelegramService, Prisma repository, and sender adapter.
 * MainFuncs: Registers Telegram presentation, application, persistence, and Telegram Bot API delivery providers.
 * SideEffects: Provides Telegram services and provider adapters through DI.
 */
import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { JimpitanModule } from '../jimpitan/jimpitan.module';
import { RbacModule } from '../rbac/rbac.module';
import { TELEGRAM_REPOSITORY, TELEGRAM_SENDER } from './telegram.tokens';
import { TelegramService } from './application/telegram.service';
import { FetchTelegramSender } from './infrastructure/fetch-telegram.sender';
import { PrismaTelegramRepository } from './infrastructure/prisma-telegram.repository';
import { TelegramController } from './presentation/telegram.controller';

@Module({
  imports: [AuthModule, RbacModule, JimpitanModule, FinanceModule, ApprovalsModule],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    PrismaTelegramRepository,
    FetchTelegramSender,
    { provide: TELEGRAM_REPOSITORY, useExisting: PrismaTelegramRepository },
    { provide: TELEGRAM_SENDER, useExisting: FetchTelegramSender },
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
