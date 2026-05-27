/**
 * Purpose: Application service for tenant-scoped finance transaction and collection posting workflows.
 * Caller: FinanceTransactionsController, future collection hook adapter, and unit tests.
 * Deps: Finance repository port, optional NotificationsService, AuthPrincipal, finance command contracts, Prisma enums, and finance domain response types.
 * MainFuncs: Enforces amount, account, category, lifecycle, immutability, tenant-scope, idempotent retry, source collection posting policies, and transaction-posted notification hooks.
 * SideEffects: Writes transaction, ledger, collection posting, audit, and optional notification/outbox changes through injected services.
 */
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { NotificationChannel, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { FINANCE_REPOSITORY } from '../finance.tokens';
import type {
  CreateFinanceTransactionCommand,
  FinanceRequestMeta,
  PostFinanceTransactionCommand,
  PostValidatedCollectionCommand,
  RejectFinanceTransactionCommand,
  TransactionListQuery,
  ValidateFinanceTransactionCommand,
  VoidFinanceTransactionCommand,
} from './finance.commands';
import type { FinanceTransactionRecord, SourceCollectionPostingResult } from '../domain/finance.types';
import type { FinanceRepositoryPort } from '../infrastructure/finance.repository.port';

export const VALIDATED_TRANSACTION_STATUS = 'VALIDATED' as TransactionStatus;

@Injectable()
export class FinanceTransactionsService {
  constructor(
    @Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepositoryPort,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async listTransactions(actor: AuthPrincipal, query: TransactionListQuery): Promise<PaginatedResult<FinanceTransactionRecord>> {
    return this.repository.listTransactions(actor.rtId, query);
  }

  async getTransaction(actor: AuthPrincipal, transactionId: string): Promise<FinanceTransactionRecord> {
    return this.getTransactionOrThrow(actor.rtId, transactionId);
  }

  async createIncomeDraft(actor: AuthPrincipal, command: CreateFinanceTransactionCommand, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord> {
    await this.assertDraftInputs(actor.rtId, command, TransactionType.INCOME);
    return this.repository.createIncomeDraft(actor.rtId, command, actor, meta);
  }

  async createExpenseDraft(actor: AuthPrincipal, command: CreateFinanceTransactionCommand, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord> {
    await this.assertDraftInputs(actor.rtId, command, TransactionType.EXPENSE);
    return this.repository.createExpenseDraft(actor.rtId, command, actor, meta);
  }

  async validateTransaction(
    actor: AuthPrincipal,
    transactionId: string,
    command: ValidateFinanceTransactionCommand,
    meta: FinanceRequestMeta,
  ): Promise<FinanceTransactionRecord> {
    const transaction = await this.getTransactionOrThrow(actor.rtId, transactionId);
    if (transaction.status !== TransactionStatus.DRAFT) {
      throw new BadRequestException('Only draft transactions can be validated.');
    }
    const updated = await this.repository.validateTransaction(actor.rtId, transactionId, command, actor, meta);
    if (!updated) {
      throw new NotFoundException('Transaction was not found.');
    }
    return updated;
  }

  async rejectTransaction(
    actor: AuthPrincipal,
    transactionId: string,
    command: RejectFinanceTransactionCommand,
    meta: FinanceRequestMeta,
  ): Promise<FinanceTransactionRecord> {
    const transaction = await this.getTransactionOrThrow(actor.rtId, transactionId);
    if (transaction.status !== TransactionStatus.DRAFT && transaction.status !== VALIDATED_TRANSACTION_STATUS) {
      throw new BadRequestException('Only draft or validated transactions can be rejected.');
    }
    const rejected = await this.repository.rejectTransaction(actor.rtId, transactionId, command, actor, meta);
    if (!rejected) {
      throw new NotFoundException('Transaction was not found.');
    }
    return rejected;
  }

  async voidDraftTransaction(
    actor: AuthPrincipal,
    transactionId: string,
    command: VoidFinanceTransactionCommand,
    meta: FinanceRequestMeta,
  ): Promise<FinanceTransactionRecord> {
    const transaction = await this.getTransactionOrThrow(actor.rtId, transactionId);
    if (transaction.status !== TransactionStatus.DRAFT) {
      throw new BadRequestException('Only draft transactions can be voided.');
    }
    const voided = await this.repository.voidDraftTransaction(actor.rtId, transactionId, command, actor, meta);
    if (!voided) {
      throw new NotFoundException('Transaction was not found.');
    }
    return voided;
  }

  async postTransaction(
    actor: AuthPrincipal,
    transactionId: string,
    command: PostFinanceTransactionCommand,
    meta: FinanceRequestMeta,
  ): Promise<FinanceTransactionRecord> {
    const transaction = await this.getTransactionOrThrow(actor.rtId, transactionId);
    if (transaction.status !== VALIDATED_TRANSACTION_STATUS && transaction.status !== TransactionStatus.POSTED) {
      throw new BadRequestException('Only validated transactions can be posted.');
    }
    const posted = await this.repository.postTransaction(actor.rtId, transactionId, command, actor, meta);
    if (!posted) {
      throw new NotFoundException('Transaction was not found.');
    }
    await this.notifyTransactionPosted(actor, posted, meta);
    return posted;
  }

  async postValidatedCollection(
    actor: AuthPrincipal,
    command: PostValidatedCollectionCommand,
    meta: FinanceRequestMeta,
  ): Promise<SourceCollectionPostingResult> {
    const result = await this.repository.postValidatedCollection(actor.rtId, command, actor, meta);
    await this.notifyTransactionPosted(actor, result.transaction, meta);
    return result;
  }

  private async assertDraftInputs(rtId: string, command: CreateFinanceTransactionCommand, type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>): Promise<void> {
    if (command.sourceCollectionId) {
      throw new BadRequestException('Source collection transactions must be posted through the collection posting endpoint.');
    }
    this.assertPositiveAmount(command.amount);
    const [account, category] = await Promise.all([
      this.repository.findCashAccountById(rtId, command.cashAccountId),
      this.repository.findCategoryById(rtId, command.categoryId),
    ]);
    if (!account || !account.isActive) {
      throw new BadRequestException('Active cash account is required.');
    }
    if (!category || !category.isActive) {
      throw new BadRequestException('Active transaction category is required.');
    }
    if (category.type !== type) {
      throw new BadRequestException('Transaction category type does not match transaction type.');
    }
  }

  private assertPositiveAmount(amount: string): void {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount)) {
      throw new BadRequestException('Transaction amount must fit cash precision and scale.');
    }
    const parsed = new Prisma.Decimal(amount);
    if (parsed.lte(0)) {
      throw new BadRequestException('Transaction amount must be greater than zero.');
    }
  }

  private async getTransactionOrThrow(rtId: string, transactionId: string): Promise<FinanceTransactionRecord> {
    const transaction = await this.repository.findTransactionById(rtId, transactionId);
    if (!transaction) {
      throw new NotFoundException('Transaction was not found.');
    }
    return transaction;
  }

  private async notifyTransactionPosted(actor: AuthPrincipal, transaction: FinanceTransactionRecord, meta: FinanceRequestMeta): Promise<void> {
    if (!this.notificationsService || transaction.status !== TransactionStatus.POSTED) {
      return;
    }
    try {
      await this.notificationsService.createNotifications(
        actor,
        {
          type: 'TRANSACTION_POSTED',
          title: 'Transaction posted',
          body: 'A finance transaction was posted to the cash ledger.',
          channels: [NotificationChannel.IN_APP],
          recipients: [{ userId: actor.userId }],
          payload: { transactionId: transaction.id, amount: transaction.amount, type: transaction.type, sourceCollectionId: transaction.sourceCollectionId },
          idempotencyKey: `transaction:${transaction.id}:posted`,
          dedupeKey: `transaction:${transaction.id}:posted`,
        },
        meta,
      );
    } catch (_error) {
      return;
    }
  }
}
