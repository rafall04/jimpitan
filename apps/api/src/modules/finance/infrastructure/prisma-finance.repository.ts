/**
 * Purpose: Prisma persistence adapter for tenant-scoped finance, collection posting, and ledger writes.
 * Caller: FinanceModule dependency injection for finance services.
 * Deps: PrismaService, Prisma enums/types, AuthPrincipal, and finance repository port.
 * MainFuncs: Performs scoped cash account/category CRUD, transaction lifecycle, atomic ledger posting, balances, idempotency, mode-aware source collection posting, and audit writes.
 * SideEffects: Reads and writes cash_accounts, transaction_categories, transactions, cash_ledgers, jimpitan_collections, collection_items, and audit_logs.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ApprovalStatus, AuditActorType, CollectionItemStatus, CollectionMode, CollectionStatus, LedgerEntryType, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { VALIDATED_TRANSACTION_STATUS } from '../application/finance-transactions.service';
import type {
  ArchiveCashAccountCommand,
  ArchiveTransactionCategoryCommand,
  CashAccountListQuery,
  CategoryListQuery,
  CreateCashAccountCommand,
  CreateFinanceTransactionCommand,
  CreateTransactionCategoryCommand,
  FinanceRequestMeta,
  PostFinanceTransactionCommand,
  PostValidatedCollectionCommand,
  RejectFinanceTransactionCommand,
  TransactionListQuery,
  UpdateCashAccountCommand,
  UpdateTransactionCategoryCommand,
  ValidateFinanceTransactionCommand,
  VoidFinanceTransactionCommand,
} from '../application/finance.commands';
import type { CashAccountBalance, CashAccountRecord, CashLedgerRecord, FinanceTransactionRecord, SourceCollectionPostingResult, TransactionCategoryRecord } from '../domain/finance.types';
import type { FinanceRepositoryPort } from './finance.repository.port';

type CashAccountDbRow = {
  id: string;
  rtId: string;
  key: string;
  name: string;
  currency: string;
  currentBalance: Prisma.Decimal;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryDbRow = {
  id: string;
  rtId: string | null;
  type: TransactionType;
  key: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type LedgerDbRow = {
  id: string;
  rtId: string;
  cashAccountId: string;
  transactionId: string;
  ledgerSequence: number;
  entryType: LedgerEntryType;
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  ledgerDate: Date;
  createdAt: Date;
};

type TransactionDbRow = {
  id: string;
  rtId: string;
  cashAccountId: string;
  categoryId: string;
  sourceCollectionId: string | null;
  referenceNumber: string | null;
  idempotencyKey: string | null;
  externalRef: string | null;
  type: TransactionType;
  status: TransactionStatus;
  amount: Prisma.Decimal;
  description: string;
  transactionDate: Date;
  createdById: string;
  updatedById: string | null;
  validatedById: string | null;
  validatedAt: Date | null;
  validationNote: string | null;
  rejectedById: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  postedById: string | null;
  postedAt: Date | null;
  voidedById: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cashAccount: {
    id: string;
    key: string;
    name: string;
    currency: string;
  };
  category: {
    id: string;
    type: TransactionType;
    key: string;
    name: string;
  };
  ledger: LedgerDbRow | null;
};

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'>;

type FinanceAuditInput = {
  rtId: string;
  actor: AuthPrincipal;
  meta: FinanceRequestMeta;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
};

class FinanceReplayConflict extends ConflictException {
  constructor(
    readonly auditInput: FinanceAuditInput,
    message = 'Idempotency replay does not match the original financial request.',
  ) {
    super(message);
  }
}

class FinanceApprovalGateException extends BadRequestException {
  constructor(readonly auditInput: FinanceAuditInput) {
    super('Expense transaction requires completed approval before posting.');
  }
}

type ExpenseApprovalPolicy = {
  thresholdAmount: string;
  autoApproveBelowThreshold: boolean;
  requiredApprovals: number;
};

const DEFAULT_EXPENSE_APPROVAL_POLICY: ExpenseApprovalPolicy = {
  thresholdAmount: '50000',
  autoApproveBelowThreshold: true,
  requiredApprovals: 1,
};

@Injectable()
export class PrismaFinanceRepository implements FinanceRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listCashAccounts(rtId: string, query: CashAccountListQuery): Promise<PaginatedResult<CashAccountRecord>> {
    const where: Prisma.CashAccountWhereInput = {
      rtId,
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };
    const [accounts, total] = await this.prisma.$transaction([
      this.prisma.cashAccount.findMany({
        where,
        select: this.cashAccountSelect(),
        orderBy: this.cashAccountOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashAccount.count({ where }),
    ]);

    return this.toPaginated(accounts.map((account) => this.toCashAccountRecord(account)), query.page, query.limit, total);
  }

  async findCashAccountById(rtId: string, cashAccountId: string): Promise<CashAccountRecord | null> {
    const account = await this.prisma.cashAccount.findFirst({
      where: { id: cashAccountId, rtId, deletedAt: null },
      select: this.cashAccountSelect(),
    });

    return account ? this.toCashAccountRecord(account) : null;
  }

  async findDefaultCashAccount(rtId: string): Promise<CashAccountRecord | null> {
    const account = await this.prisma.cashAccount.findFirst({
      where: { rtId, key: 'main', deletedAt: null },
      select: this.cashAccountSelect(),
    });

    return account ? this.toCashAccountRecord(account) : null;
  }

  async createCashAccount(rtId: string, command: CreateCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const account = await tx.cashAccount.create({
          data: {
            rtId,
            key: command.key ?? 'main',
            name: command.name,
            currency: command.currency ?? 'IDR',
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.cashAccountSelect(),
        });
        const afterData = this.toCashAccountRecord(account);
        await this.writeAudit(tx, { rtId, actor, meta, action: 'CASH_ACCOUNT_CREATED', entityType: 'cash_account', entityId: account.id, afterData });
        return afterData;
      });
    } catch (error) {
      this.throwKnownConflict(error, 'Cash account could not be created because the key already exists.');
    }
  }

  async updateCashAccount(rtId: string, cashAccountId: string, command: UpdateCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.cashAccount.findFirst({ where: { id: cashAccountId, rtId, deletedAt: null }, select: this.cashAccountSelect() });
      if (!before) {
        return null;
      }
      const update = await tx.cashAccount.updateMany({
        where: { id: cashAccountId, rtId, deletedAt: null },
        data: {
          ...(command.name === undefined ? {} : { name: command.name }),
          ...(command.isActive === undefined ? {} : { isActive: command.isActive }),
          updatedById: actor.userId,
        },
      });
      this.assertSingleMutation(update.count);
      const account = await tx.cashAccount.findFirst({ where: { id: cashAccountId, rtId, deletedAt: null }, select: this.cashAccountSelect() });
      if (!account) {
        throw new BadRequestException('Cash account changed while processing the request.');
      }
      const beforeData = this.toCashAccountRecord(before);
      const afterData = this.toCashAccountRecord(account);
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CASH_ACCOUNT_UPDATED', entityType: 'cash_account', entityId: cashAccountId, beforeData, afterData });
      return afterData;
    });
  }

  async archiveCashAccount(rtId: string, cashAccountId: string, command: ArchiveCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.cashAccount.findFirst({ where: { id: cashAccountId, rtId, deletedAt: null }, select: this.cashAccountSelect() });
      if (!before) {
        return null;
      }
      const postedLedgerCount = await tx.cashLedger.count({ where: { rtId, cashAccountId } });
      const account = await tx.cashAccount.update({
        where: { id: cashAccountId },
        data: {
          isActive: false,
          deletedById: postedLedgerCount > 0 ? null : actor.userId,
          deletedAt: postedLedgerCount > 0 ? null : new Date(),
          updatedById: actor.userId,
        },
        select: this.cashAccountSelect(),
      });
      const beforeData = this.toCashAccountRecord(before);
      const afterData = this.toCashAccountRecord(account);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'CASH_ACCOUNT_ARCHIVED',
        entityType: 'cash_account',
        entityId: cashAccountId,
        beforeData,
        afterData: { ...afterData, reason: command.reason, inactiveOnly: postedLedgerCount > 0 },
      });
      return afterData;
    });
  }

  async getCashAccountBalance(rtId: string, cashAccountId: string): Promise<CashAccountBalance | null> {
    const account = await this.prisma.cashAccount.findFirst({ where: { id: cashAccountId, rtId, deletedAt: null }, select: { id: true } });
    if (!account) {
      return null;
    }
    const latestLedger = await this.prisma.cashLedger.findFirst({
      where: { rtId, cashAccountId },
      orderBy: [{ ledgerSequence: 'desc' }, { id: 'desc' }],
      select: { ledgerSequence: true, balanceAfter: true },
    });

    return {
      cashAccountId,
      balance: (latestLedger?.balanceAfter ?? new Prisma.Decimal(0)).toString(),
      ledgerSequence: latestLedger?.ledgerSequence ?? 0,
      calculatedAt: new Date(),
    };
  }

  async listCategories(rtId: string, query: CategoryListQuery): Promise<PaginatedResult<TransactionCategoryRecord>> {
    const where: Prisma.TransactionCategoryWhereInput = {
      deletedAt: null,
      OR: [{ rtId }, { rtId: null, isSystem: true }],
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { key: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                  { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            ],
          }
        : {}),
    };
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.transactionCategory.findMany({
        where,
        select: this.categorySelect(),
        orderBy: this.categoryOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transactionCategory.count({ where }),
    ]);

    return this.toPaginated(categories.map((category) => this.toCategoryRecord(category)), query.page, query.limit, total);
  }

  async findCategoryById(rtId: string, categoryId: string): Promise<TransactionCategoryRecord | null> {
    const category = await this.prisma.transactionCategory.findFirst({
      where: { id: categoryId, deletedAt: null, OR: [{ rtId }, { rtId: null, isSystem: true }] },
      select: this.categorySelect(),
    });

    return category ? this.toCategoryRecord(category) : null;
  }

  async findSystemCategory(rtId: string, input: { key: string; type: 'INCOME' | 'EXPENSE' }): Promise<TransactionCategoryRecord | null> {
    const category = await this.prisma.transactionCategory.findFirst({
      where: {
        key: input.key,
        type: input.type,
        deletedAt: null,
        OR: [{ rtId }, { rtId: null, isSystem: true }],
      },
      orderBy: [{ rtId: 'desc' }, { isSystem: 'desc' }],
      select: this.categorySelect(),
    });

    return category ? this.toCategoryRecord(category) : null;
  }

  async createCategory(rtId: string, command: CreateTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.transactionCategory.create({
          data: {
            rtId,
            type: command.type,
            key: command.key,
            name: command.name,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.categorySelect(),
        });
        const afterData = this.toCategoryRecord(category);
        await this.writeAudit(tx, { rtId, actor, meta, action: 'TRANSACTION_CATEGORY_CREATED', entityType: 'transaction_category', entityId: category.id, afterData });
        return afterData;
      });
    } catch (error) {
      this.throwKnownConflict(error, 'Transaction category could not be created because the key already exists.');
    }
  }

  async updateCategory(rtId: string, categoryId: string, command: UpdateTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.transactionCategory.findFirst({ where: { id: categoryId, rtId, deletedAt: null }, select: this.categorySelect() });
      if (!before) {
        return null;
      }
      const update = await tx.transactionCategory.updateMany({
        where: { id: categoryId, rtId, deletedAt: null },
        data: {
          ...(command.name === undefined ? {} : { name: command.name }),
          ...(command.isActive === undefined ? {} : { isActive: command.isActive }),
          updatedById: actor.userId,
        },
      });
      this.assertSingleMutation(update.count);
      const category = await tx.transactionCategory.findFirst({ where: { id: categoryId, rtId, deletedAt: null }, select: this.categorySelect() });
      if (!category) {
        throw new BadRequestException('Transaction category changed while processing the request.');
      }
      const beforeData = this.toCategoryRecord(before);
      const afterData = this.toCategoryRecord(category);
      await this.writeAudit(tx, { rtId, actor, meta, action: 'TRANSACTION_CATEGORY_UPDATED', entityType: 'transaction_category', entityId: categoryId, beforeData, afterData });
      return afterData;
    });
  }

  async archiveCategory(rtId: string, categoryId: string, command: ArchiveTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.transactionCategory.findFirst({ where: { id: categoryId, rtId, deletedAt: null }, select: this.categorySelect() });
      if (!before) {
        return null;
      }
      const category = await tx.transactionCategory.update({
        where: { id: categoryId },
        data: { isActive: false, deletedById: actor.userId, deletedAt: new Date(), updatedById: actor.userId },
        select: this.categorySelect(),
      });
      const beforeData = this.toCategoryRecord(before);
      const afterData = this.toCategoryRecord(category);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TRANSACTION_CATEGORY_ARCHIVED',
        entityType: 'transaction_category',
        entityId: categoryId,
        beforeData,
        afterData: { ...afterData, reason: command.reason },
      });
      return afterData;
    });
  }

  async listTransactions(rtId: string, query: TransactionListQuery): Promise<PaginatedResult<FinanceTransactionRecord>> {
    const where = this.transactionWhere(rtId, query);
    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        select: this.transactionSelect(),
        orderBy: this.transactionOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return this.toPaginated(transactions.map((transaction) => this.toTransactionRecord(transaction)), query.page, query.limit, total);
  }

  async findTransactionById(rtId: string, transactionId: string): Promise<FinanceTransactionRecord | null> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, rtId, deletedAt: null },
      select: this.transactionSelect(),
    });

    return transaction ? this.toTransactionRecord(transaction) : null;
  }

  async createIncomeDraft(rtId: string, command: CreateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord> {
    return this.createTransactionDraft(rtId, TransactionType.INCOME, command, actor, meta);
  }

  async createExpenseDraft(rtId: string, command: CreateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord> {
    return this.createTransactionDraft(rtId, TransactionType.EXPENSE, command, actor, meta);
  }

  async validateTransaction(rtId: string, transactionId: string, command: ValidateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findTransactionInTransaction(tx, rtId, transactionId);
      if (!before) {
        return null;
      }
      if (before.status !== TransactionStatus.DRAFT) {
        throw new BadRequestException('Only draft transactions can be validated.');
      }
      const update = await tx.transaction.updateMany({
        where: { id: transactionId, rtId, status: TransactionStatus.DRAFT, deletedAt: null },
        data: { status: VALIDATED_TRANSACTION_STATUS, validatedById: actor.userId, validatedAt: new Date(), validationNote: command.validationNote, updatedById: actor.userId },
      });
      this.assertSingleMutation(update.count);
      const after = await this.findTransactionInTransactionOrThrow(tx, rtId, transactionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TRANSACTION_VALIDATED',
        entityType: 'transaction',
        entityId: transactionId,
        beforeData: this.toTransactionRecord(before),
        afterData: this.toTransactionRecord(after),
      });
      return this.toTransactionRecord(after);
    });
  }

  async rejectTransaction(rtId: string, transactionId: string, command: RejectFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findTransactionInTransaction(tx, rtId, transactionId);
      if (!before) {
        return null;
      }
      if (before.status !== TransactionStatus.DRAFT && before.status !== VALIDATED_TRANSACTION_STATUS) {
        throw new BadRequestException('Only draft or validated transactions can be rejected.');
      }
      const update = await tx.transaction.updateMany({
        where: { id: transactionId, rtId, status: { in: [TransactionStatus.DRAFT, VALIDATED_TRANSACTION_STATUS] }, deletedAt: null },
        data: { status: TransactionStatus.REJECTED, rejectedById: actor.userId, rejectedAt: new Date(), rejectionReason: command.rejectionReason, updatedById: actor.userId },
      });
      this.assertSingleMutation(update.count);
      const after = await this.findTransactionInTransactionOrThrow(tx, rtId, transactionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TRANSACTION_REJECTED',
        entityType: 'transaction',
        entityId: transactionId,
        beforeData: this.toTransactionRecord(before),
        afterData: this.toTransactionRecord(after),
      });
      return this.toTransactionRecord(after);
    });
  }

  async voidDraftTransaction(rtId: string, transactionId: string, command: VoidFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findTransactionInTransaction(tx, rtId, transactionId);
      if (!before) {
        return null;
      }
      if (before.status !== TransactionStatus.DRAFT) {
        throw new BadRequestException('Only draft transactions can be voided.');
      }
      const update = await tx.transaction.updateMany({
        where: { id: transactionId, rtId, status: TransactionStatus.DRAFT, deletedAt: null },
        data: { status: TransactionStatus.VOIDED, voidedById: actor.userId, voidedAt: new Date(), updatedById: actor.userId },
      });
      this.assertSingleMutation(update.count);
      const after = await this.findTransactionInTransactionOrThrow(tx, rtId, transactionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TRANSACTION_VOIDED',
        entityType: 'transaction',
        entityId: transactionId,
        beforeData: this.toTransactionRecord(before),
        afterData: { transaction: this.toTransactionRecord(after), reason: command.voidReason },
      });
      return this.toTransactionRecord(after);
    });
  }

  async postTransaction(rtId: string, transactionId: string, command: PostFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null> {
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const before = await this.findTransactionInTransaction(tx, rtId, transactionId);
            if (!before) {
              return null;
            }
            if (before.status === TransactionStatus.POSTED) {
              this.assertReplayKeyMatchesInTransaction({
                rtId,
                actor,
                meta,
                entityType: 'transaction',
                entityId: before.id,
                existingKey: before.idempotencyKey,
                requestedKey: command.idempotencyKey,
                afterData: { transactionId: before.id, status: before.status },
              });
              await this.writeAudit(tx, { rtId, actor, meta, action: 'FINANCE_IDEMPOTENCY_REPLAYED', entityType: 'transaction', entityId: before.id, afterData: this.toTransactionRecord(before) });
              return this.toTransactionRecord(before);
            }
            if (before.status !== VALIDATED_TRANSACTION_STATUS) {
              throw new BadRequestException('Only validated transactions can be posted.');
            }
            await this.assertPostingInputsInTransaction(tx, rtId, before, actor, meta);
            await this.assertPostIdempotencyInTransaction(tx, rtId, before, command.idempotencyKey, actor, meta);
            const ledger = await this.appendLedgerForTransaction(tx, rtId, before, actor, meta);
            const update = await tx.transaction.updateMany({
              where: { id: transactionId, rtId, status: VALIDATED_TRANSACTION_STATUS, deletedAt: null },
              data: { status: TransactionStatus.POSTED, idempotencyKey: command.idempotencyKey ?? before.idempotencyKey, postedById: actor.userId, postedAt: ledger.ledgerDate, updatedById: actor.userId },
            });
            this.assertSingleMutation(update.count);
            const after = await this.findTransactionInTransactionOrThrow(tx, rtId, transactionId);
            await this.writeAudit(tx, {
              rtId,
              actor,
              meta,
              action: 'TRANSACTION_POSTED',
              entityType: 'transaction',
              entityId: transactionId,
              beforeData: this.toTransactionRecord(before),
              afterData: { transaction: this.toTransactionRecord(after), ledger: this.toLedgerRecord(ledger) },
            });
            return this.toTransactionRecord(after);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (error instanceof FinanceReplayConflict) {
        await this.writeAudit(this.prisma, error.auditInput);
        throw error;
      }
      if (error instanceof FinanceApprovalGateException) {
        await this.writeAudit(this.prisma, error.auditInput);
        throw error;
      }
      const posted = await this.findTransactionById(rtId, transactionId);
      if (this.isKnownConcurrencyConflict(error) && posted?.status === TransactionStatus.POSTED) {
        await this.assertReplayKeyMatchesOutside({
          rtId,
          actor,
          meta,
          entityType: 'transaction',
          entityId: posted.id,
          existingKey: posted.idempotencyKey,
          requestedKey: command.idempotencyKey,
          afterData: { transactionId: posted.id, status: posted.status },
        });
        await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'FINANCE_IDEMPOTENCY_REPLAYED', entityType: 'transaction', entityId: posted.id, afterData: posted });
        return posted;
      }
      this.throwKnownConflict(error, 'Transaction could not be posted because a duplicate ledger sequence, idempotency key, or source already exists.');
    }
  }

  async postValidatedCollection(rtId: string, command: PostValidatedCollectionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<SourceCollectionPostingResult> {
    try {
      return await this.withSerializableRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
          const existing = await tx.transaction.findFirst({
            where: { rtId, sourceCollectionId: command.collectionId, deletedAt: null },
            select: this.transactionSelect(),
          });
          if (existing) {
            this.assertReplayKeyMatchesInTransaction({
              rtId,
              actor,
              meta,
              entityType: 'jimpitan_collection',
              entityId: command.collectionId,
              existingKey: existing.idempotencyKey,
              requestedKey: command.idempotencyKey,
              afterData: { transactionId: existing.id, sourceCollectionId: command.collectionId, status: existing.status },
            });
            if (existing.status === TransactionStatus.POSTED && existing.ledger) {
              await this.writeAudit(tx, {
                rtId,
                actor,
                meta,
                action: 'FINANCE_IDEMPOTENCY_REPLAYED',
                entityType: 'jimpitan_collection',
                entityId: command.collectionId,
                afterData: { transactionId: existing.id, sourceCollectionId: command.collectionId },
              });
              return { collectionId: command.collectionId, transaction: this.toTransactionRecord(existing), ledger: this.toLedgerRecord(existing.ledger) };
            }
            throw new FinanceReplayConflict(
              {
                rtId,
                actor,
                meta,
                action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
                entityType: 'jimpitan_collection',
                entityId: command.collectionId,
                afterData: { transactionId: existing.id, status: existing.status, reason: 'Existing source collection transaction is not posted.' },
              },
              'Collection posting is already in progress or incomplete.',
            );
          }

          const collection = await tx.jimpitanCollection.findFirst({
            where: { id: command.collectionId, rtId },
            select: { id: true, rtId: true, collectionMode: true, status: true, totalAmount: true, collectionDate: true },
          });
          if (!collection || collection.status !== CollectionStatus.VALIDATED) {
            throw new BadRequestException('Only validated collections can be posted to finance.');
          }
          const totalAmount = await this.resolveCollectionPostingAmount(tx, rtId, collection);

          const account = command.cashAccountId
            ? await this.findActiveCashAccountInTransaction(tx, rtId, command.cashAccountId)
            : await this.findOrCreateDefaultCashAccountInTransaction(tx, rtId, actor.userId);
          const category = command.categoryId
            ? await this.findActiveCategoryInTransaction(tx, rtId, command.categoryId, TransactionType.INCOME)
            : await this.findOrCreateJimpitanCategoryInTransaction(tx, rtId, actor.userId);
          const now = new Date();
          const transaction = await tx.transaction.create({
            data: {
              rtId,
              cashAccountId: account.id,
              categoryId: category.id,
              sourceCollectionId: command.collectionId,
              idempotencyKey: command.idempotencyKey ?? `collection:${command.collectionId}`,
              type: TransactionType.INCOME,
              status: VALIDATED_TRANSACTION_STATUS,
              amount: totalAmount,
              description: `Jimpitan collection ${command.collectionId}`,
              transactionDate: collection.collectionDate,
              createdById: actor.userId,
              updatedById: actor.userId,
              validatedById: actor.userId,
              validatedAt: now,
              validationNote: 'Validated jimpitan collection posted to finance.',
            },
            select: this.transactionSelect(),
          });
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'TRANSACTION_CREATED',
            entityType: 'transaction',
            entityId: transaction.id,
            afterData: this.toTransactionRecord(transaction),
          });
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'TRANSACTION_VALIDATED',
            entityType: 'transaction',
            entityId: transaction.id,
            afterData: this.toTransactionRecord(transaction),
          });
          const ledger = await this.appendLedgerForTransaction(tx, rtId, transaction, actor, meta);
          const update = await tx.transaction.updateMany({
            where: { id: transaction.id, rtId, status: VALIDATED_TRANSACTION_STATUS, deletedAt: null },
            data: { status: TransactionStatus.POSTED, postedById: actor.userId, postedAt: ledger.ledgerDate, updatedById: actor.userId },
          });
          this.assertSingleMutation(update.count);
          const posted = await this.findTransactionInTransactionOrThrow(tx, rtId, transaction.id);
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'COLLECTION_POSTED_TO_FINANCE',
            entityType: 'jimpitan_collection',
            entityId: command.collectionId,
            afterData: { collectionMode: collection.collectionMode, collectionTotalAmount: totalAmount.toString(), transaction: this.toTransactionRecord(posted), ledger: this.toLedgerRecord(ledger) },
          });
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'TRANSACTION_POSTED',
            entityType: 'transaction',
            entityId: posted.id,
            afterData: { transaction: this.toTransactionRecord(posted), ledger: this.toLedgerRecord(ledger) },
          });
          return {
            collectionId: command.collectionId,
            collectionMode: collection.collectionMode,
            collectionTotalAmount: totalAmount.toString(),
            transaction: this.toTransactionRecord(posted),
            ledger: this.toLedgerRecord(ledger),
          };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
    } catch (error) {
      if (error instanceof FinanceReplayConflict) {
        await this.writeAudit(this.prisma, error.auditInput);
        throw error;
      }
      if (this.isKnownConcurrencyConflict(error)) {
        const existing = await this.prisma.transaction.findFirst({
          where: { rtId, sourceCollectionId: command.collectionId, deletedAt: null },
          select: this.transactionSelect(),
        });
        if (existing?.status === TransactionStatus.POSTED && existing.ledger) {
          await this.assertReplayKeyMatchesOutside({
            rtId,
            actor,
            meta,
            entityType: 'jimpitan_collection',
            entityId: command.collectionId,
            existingKey: existing.idempotencyKey,
            requestedKey: command.idempotencyKey,
            afterData: { transactionId: existing.id, sourceCollectionId: command.collectionId, status: existing.status },
          });
          await this.writeAudit(this.prisma, {
            rtId,
            actor,
            meta,
            action: 'FINANCE_IDEMPOTENCY_REPLAYED',
            entityType: 'jimpitan_collection',
            entityId: command.collectionId,
            afterData: { transactionId: existing.id, sourceCollectionId: command.collectionId },
          });
          return { collectionId: command.collectionId, transaction: this.toTransactionRecord(existing), ledger: this.toLedgerRecord(existing.ledger) };
        }
      }
      this.throwKnownConflict(error, 'Collection could not be posted because it was already posted or ledger sequence changed concurrently.');
    }
  }

  private async createTransactionDraft(
    rtId: string,
    type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
    command: CreateFinanceTransactionCommand,
    actor: AuthPrincipal,
    meta: FinanceRequestMeta,
  ): Promise<FinanceTransactionRecord> {
    if (command.sourceCollectionId) {
      throw new BadRequestException('Source collection transactions must be posted through the collection posting endpoint.');
    }
    if (command.idempotencyKey) {
      const existing = await this.prisma.transaction.findFirst({ where: { rtId, idempotencyKey: command.idempotencyKey, deletedAt: null }, select: this.transactionSelect() });
      if (existing) {
        await this.assertIdempotentCreateMatches(existing, command, type, actor, meta);
        await this.writeAudit(this.prisma, {
          rtId,
          actor,
          meta,
          action: 'FINANCE_IDEMPOTENCY_REPLAYED',
          entityType: 'transaction',
          entityId: existing.id,
          afterData: this.toTransactionRecord(existing),
        });
        return this.toTransactionRecord(existing);
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertDraftReferencesInTransaction(tx, rtId, command, type);
        const transaction = await tx.transaction.create({
          data: {
            rtId,
            cashAccountId: command.cashAccountId,
            categoryId: command.categoryId,
            sourceCollectionId: command.sourceCollectionId,
            referenceNumber: command.referenceNumber,
            idempotencyKey: command.idempotencyKey,
            externalRef: command.externalRef,
            type,
            status: TransactionStatus.DRAFT,
            amount: command.amount,
            description: command.description,
            transactionDate: this.toDate(command.transactionDate),
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.transactionSelect(),
        });
        const afterData = this.toTransactionRecord(transaction);
        await this.writeAudit(tx, { rtId, actor, meta, action: 'TRANSACTION_CREATED', entityType: 'transaction', entityId: transaction.id, afterData });
        return afterData;
      });
    } catch (error) {
      const replay = await this.resolveIdempotentCreateConflict(rtId, command, type, actor, meta, error);
      if (replay) {
        return replay;
      }
      this.throwKnownConflict(error, 'Transaction could not be created because a duplicate reference, idempotency key, external reference, or source collection exists.');
    }
  }

  private async assertDraftReferencesInTransaction(
    tx: Prisma.TransactionClient,
    rtId: string,
    command: CreateFinanceTransactionCommand,
    type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
  ): Promise<void> {
    await this.findActiveCashAccountInTransaction(tx, rtId, command.cashAccountId);
    await this.findActiveCategoryInTransaction(tx, rtId, command.categoryId, type);
    if (command.sourceCollectionId) {
      const collection = await tx.jimpitanCollection.findFirst({
        where: { id: command.sourceCollectionId, rtId, status: CollectionStatus.VALIDATED },
        select: { id: true },
      });
      if (!collection) {
        throw new BadRequestException('Source collection must be validated and belong to the current tenant.');
      }
    }
  }

  private async assertPostingInputsInTransaction(tx: Prisma.TransactionClient, rtId: string, transaction: TransactionDbRow, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<void> {
    await this.findActiveCashAccountInTransaction(tx, rtId, transaction.cashAccountId);
    await this.findActiveCategoryInTransaction(tx, rtId, transaction.categoryId, transaction.type);
    await this.assertExpenseApprovalGateInTransaction(tx, rtId, transaction, actor, meta);
  }

  private async assertExpenseApprovalGateInTransaction(
    tx: Prisma.TransactionClient,
    rtId: string,
    transaction: TransactionDbRow,
    actor: AuthPrincipal,
    meta: FinanceRequestMeta,
  ): Promise<void> {
    if (transaction.type !== TransactionType.EXPENSE) {
      return;
    }
    const policy = await this.findExpenseApprovalPolicyInTransaction(tx, rtId);
    if (policy.autoApproveBelowThreshold && transaction.amount.lte(policy.thresholdAmount)) {
      return;
    }
    const approvals = await tx.expenseApproval.findMany({
      where: { rtId, transactionId: transaction.id },
      select: { id: true, status: true },
    });
    const approvedCount = approvals.filter((approval) => approval.status === ApprovalStatus.APPROVED).length;
    const rejectedCount = approvals.filter((approval) => approval.status === ApprovalStatus.REJECTED).length;
    if (rejectedCount > 0) {
      throw new BadRequestException('Expense transaction has rejected approval.');
    }
    if (approvedCount < policy.requiredApprovals) {
      throw new FinanceApprovalGateException({
        rtId,
        actor,
        meta,
        action: 'TRANSACTION_POST_BLOCKED_APPROVAL_REQUIRED',
        entityType: 'transaction',
        entityId: transaction.id,
        afterData: { transactionId: transaction.id, approvedCount, requiredApprovals: policy.requiredApprovals, approvalCount: approvals.length },
      });
    }
  }

  private async findExpenseApprovalPolicyInTransaction(tx: Prisma.TransactionClient, rtId: string): Promise<ExpenseApprovalPolicy> {
    const setting = await tx.setting.findUnique({
      where: { rtId_key: { rtId, key: 'expense_approval_policy' } },
      select: { value: true },
    });
    const raw = setting?.value && typeof setting.value === 'object' && !Array.isArray(setting.value) ? (setting.value as Record<string, unknown>) : {};
    const thresholdAmount = typeof raw.thresholdAmount === 'string' ? raw.thresholdAmount : DEFAULT_EXPENSE_APPROVAL_POLICY.thresholdAmount;
    const requiredApprovals = Number.isInteger(raw.requiredApprovals) ? Math.max(1, Number(raw.requiredApprovals)) : DEFAULT_EXPENSE_APPROVAL_POLICY.requiredApprovals;
    return {
      thresholdAmount,
      autoApproveBelowThreshold: typeof raw.autoApproveBelowThreshold === 'boolean' ? raw.autoApproveBelowThreshold : DEFAULT_EXPENSE_APPROVAL_POLICY.autoApproveBelowThreshold,
      requiredApprovals,
    };
  }

  private async assertPostIdempotencyInTransaction(
    tx: Prisma.TransactionClient,
    rtId: string,
    transaction: TransactionDbRow,
    idempotencyKey: string | undefined,
    actor: AuthPrincipal,
    meta: FinanceRequestMeta,
  ): Promise<void> {
    if (!idempotencyKey) {
      return;
    }
    if (transaction.idempotencyKey && transaction.idempotencyKey !== idempotencyKey) {
      throw new FinanceReplayConflict({
        rtId,
        actor,
        meta,
        action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
        entityType: 'transaction',
        entityId: transaction.id,
        afterData: { existingKey: transaction.idempotencyKey, requestedKey: idempotencyKey },
      });
    }
    const existing = await tx.transaction.findFirst({
      where: { rtId, idempotencyKey, id: { not: transaction.id }, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new FinanceReplayConflict(
        {
          rtId,
          actor,
          meta,
          action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
          entityType: 'transaction',
          entityId: transaction.id,
          afterData: { conflictingTransactionId: existing.id, requestedKey: idempotencyKey },
        },
        'Idempotency key already belongs to another transaction.',
      );
    }
  }

  private async resolveIdempotentCreateConflict(
    rtId: string,
    command: CreateFinanceTransactionCommand,
    type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
    actor: AuthPrincipal,
    meta: FinanceRequestMeta,
    error: unknown,
  ): Promise<FinanceTransactionRecord | null> {
    if (!command.idempotencyKey || !this.isIdempotencyUniqueConflict(error)) {
      return null;
    }
    const existing = await this.prisma.transaction.findFirst({
      where: { rtId, idempotencyKey: command.idempotencyKey, deletedAt: null },
      select: this.transactionSelect(),
    });
    if (!existing) {
      return null;
    }
    await this.assertIdempotentCreateMatches(existing, command, type, actor, meta);
    await this.writeAudit(this.prisma, {
      rtId,
      actor,
      meta,
      action: 'FINANCE_IDEMPOTENCY_REPLAYED',
      entityType: 'transaction',
      entityId: existing.id,
      afterData: this.toTransactionRecord(existing),
    });
    return this.toTransactionRecord(existing);
  }

  private async assertIdempotentCreateMatches(
    existing: TransactionDbRow,
    command: CreateFinanceTransactionCommand,
    type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>,
    actor: AuthPrincipal,
    meta: FinanceRequestMeta,
  ): Promise<void> {
    const same =
      existing.type === type &&
      existing.cashAccountId === command.cashAccountId &&
      existing.categoryId === command.categoryId &&
      existing.amount.equals(command.amount) &&
      this.toDateOnly(existing.transactionDate) === command.transactionDate &&
      existing.description === command.description &&
      (existing.referenceNumber ?? undefined) === command.referenceNumber &&
      (existing.externalRef ?? undefined) === command.externalRef &&
      (existing.sourceCollectionId ?? undefined) === command.sourceCollectionId;
    if (!same) {
      await this.writeAudit(this.prisma, {
        rtId: existing.rtId,
        actor,
        meta,
        action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
        entityType: 'transaction',
        entityId: existing.id,
        afterData: { idempotencyKey: command.idempotencyKey },
      });
      throw new ConflictException('Idempotency key already belongs to a different transaction request.');
    }
  }

  private async resolveCollectionPostingAmount(
    tx: Prisma.TransactionClient,
    rtId: string,
    collection: { id: string; collectionMode: CollectionMode; totalAmount: Prisma.Decimal },
  ): Promise<Prisma.Decimal> {
    if (collection.collectionMode === CollectionMode.BULK_TOTAL) {
      if (!this.isPositiveIntegerCurrency(collection.totalAmount)) {
        throw new BadRequestException('Bulk total collection amount must be a positive integer before finance posting.');
      }
      return collection.totalAmount;
    }
    const paidTotal = await tx.collectionItem.aggregate({
      where: { rtId, collectionId: collection.id, status: CollectionItemStatus.PAID },
      _sum: { amount: true },
    });
    const totalAmount = paidTotal._sum.amount ?? new Prisma.Decimal(0);
    if (!totalAmount.equals(collection.totalAmount) || totalAmount.lte(0)) {
      throw new BadRequestException('Collection paid item total does not match the validated collection total.');
    }
    return totalAmount;
  }

  private isPositiveIntegerCurrency(value: Prisma.Decimal): boolean {
    return value.gt(0) && /^[1-9]\d*$/.test(value.toString());
  }

  private async appendLedgerForTransaction(tx: Prisma.TransactionClient, rtId: string, transaction: TransactionDbRow, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<LedgerDbRow> {
    const entryType = transaction.type === TransactionType.EXPENSE ? LedgerEntryType.DECREASE : LedgerEntryType.INCREASE;
    const accountLock = await tx.cashAccount.updateMany({
      where: { id: transaction.cashAccountId, rtId, deletedAt: null, isActive: true },
      data: { version: { increment: 1 }, updatedById: actor.userId },
    });
    this.assertSingleMutation(accountLock.count);
    const latestLedger = await tx.cashLedger.findFirst({
      where: { rtId, cashAccountId: transaction.cashAccountId },
      orderBy: [{ ledgerSequence: 'desc' }, { id: 'desc' }],
      select: { ledgerSequence: true, balanceAfter: true },
    });
    const ledgerSequence = (latestLedger?.ledgerSequence ?? 0) + 1;
    const balanceBefore = latestLedger?.balanceAfter ?? new Prisma.Decimal(0);
    const balanceAfter = entryType === LedgerEntryType.INCREASE ? balanceBefore.plus(transaction.amount) : balanceBefore.minus(transaction.amount);
    if (balanceAfter.lt(0)) {
      throw new BadRequestException('Cash account balance is insufficient for this transaction.');
    }
    const ledgerDate = new Date();
    const ledger = await tx.cashLedger.create({
      data: {
        rtId,
        cashAccountId: transaction.cashAccountId,
        transactionId: transaction.id,
        ledgerSequence,
        entryType,
        amount: transaction.amount,
        balanceBefore,
        balanceAfter,
        ledgerDate,
      },
      select: this.ledgerSelect(),
    });
    const balanceUpdate = await tx.cashAccount.updateMany({
      where: { id: transaction.cashAccountId, rtId, deletedAt: null, isActive: true },
      data: { currentBalance: balanceAfter, updatedById: actor.userId },
    });
    this.assertSingleMutation(balanceUpdate.count);
    await this.writeAudit(tx, {
      rtId,
      actor,
      meta,
      action: 'LEDGER_ENTRY_CREATED',
      entityType: 'cash_ledger',
      entityId: ledger.id,
      afterData: this.toLedgerRecord(ledger),
    });
    return ledger;
  }

  private assertSingleMutation(count: number): void {
    if (count !== 1) {
      throw new BadRequestException('Finance lifecycle state changed while processing the request.');
    }
  }

  private async findActiveCashAccountInTransaction(tx: Prisma.TransactionClient, rtId: string, cashAccountId: string): Promise<CashAccountDbRow> {
    const account = await tx.cashAccount.findFirst({
      where: { id: cashAccountId, rtId, deletedAt: null, isActive: true },
      select: this.cashAccountSelect(),
    });
    if (!account) {
      throw new BadRequestException('Active cash account is required.');
    }
    return account;
  }

  private async findActiveCategoryInTransaction(tx: Prisma.TransactionClient, rtId: string, categoryId: string, type: TransactionType): Promise<CategoryDbRow> {
    const category = await tx.transactionCategory.findFirst({
      where: {
        id: categoryId,
        deletedAt: null,
        isActive: true,
        type,
        OR: [{ rtId }, { rtId: null, isSystem: true }],
      },
      select: this.categorySelect(),
    });
    if (!category) {
      throw new BadRequestException('Active matching transaction category is required.');
    }
    return category;
  }

  private async findOrCreateDefaultCashAccountInTransaction(tx: Prisma.TransactionClient, rtId: string, actorUserId: string): Promise<CashAccountDbRow> {
    const existing = await tx.cashAccount.findFirst({ where: { rtId, key: 'main', deletedAt: null }, select: this.cashAccountSelect() });
    if (existing) {
      if (!existing.isActive) {
        throw new BadRequestException('Default cash account is archived.');
      }
      return existing;
    }
    return tx.cashAccount.create({
      data: { rtId, key: 'main', name: 'Kas Utama', currency: 'IDR', createdById: actorUserId, updatedById: actorUserId },
      select: this.cashAccountSelect(),
    });
  }

  private async findOrCreateJimpitanCategoryInTransaction(tx: Prisma.TransactionClient, rtId: string, actorUserId: string): Promise<CategoryDbRow> {
    const existing = await tx.transactionCategory.findFirst({
      where: { rtId, key: 'jimpitan', type: TransactionType.INCOME },
      select: this.categorySelect(),
    });
    if (existing) {
      if (!existing.isActive || existing.rtId !== rtId) {
        throw new BadRequestException('Jimpitan transaction category is archived.');
      }
      return existing;
    }
    return tx.transactionCategory.create({
      data: { rtId, type: TransactionType.INCOME, key: 'jimpitan', name: 'Jimpitan', isSystem: true, createdById: actorUserId, updatedById: actorUserId },
      select: this.categorySelect(),
    });
  }

  private transactionWhere(rtId: string, query: TransactionListQuery): Prisma.TransactionWhereInput {
    return {
      rtId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sourceCollectionId ? { sourceCollectionId: query.sourceCollectionId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            transactionDate: {
              ...(query.dateFrom ? { gte: this.toDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: this.toDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { referenceNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { externalRef: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { cashAccount: { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
              { category: { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
  }

  private cashAccountOrderBy(query: CashAccountListQuery): Prisma.CashAccountOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'asc';
    switch (query.sortBy ?? 'name') {
      case 'key':
        return [{ key: direction }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'name':
      default:
        return [{ name: direction }, { id: 'asc' }];
    }
  }

  private categoryOrderBy(query: CategoryListQuery): Prisma.TransactionCategoryOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'asc';
    switch (query.sortBy ?? 'name') {
      case 'key':
        return [{ key: direction }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'name':
      default:
        return [{ name: direction }, { id: 'asc' }];
    }
  }

  private transactionOrderBy(query: TransactionListQuery): Prisma.TransactionOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'transactionDate') {
      case 'amount':
        return [{ amount: direction }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { transactionDate: 'desc' }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'transactionDate':
      default:
        return [{ transactionDate: direction }, { id: 'asc' }];
    }
  }

  private cashAccountSelect() {
    return {
      id: true,
      rtId: true,
      key: true,
      name: true,
      currency: true,
      currentBalance: true,
      version: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.CashAccountSelect;
  }

  private categorySelect() {
    return {
      id: true,
      rtId: true,
      type: true,
      key: true,
      name: true,
      isSystem: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.TransactionCategorySelect;
  }

  private ledgerSelect() {
    return {
      id: true,
      rtId: true,
      cashAccountId: true,
      transactionId: true,
      ledgerSequence: true,
      entryType: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      ledgerDate: true,
      createdAt: true,
    } satisfies Prisma.CashLedgerSelect;
  }

  private transactionSelect() {
    return {
      id: true,
      rtId: true,
      cashAccountId: true,
      categoryId: true,
      sourceCollectionId: true,
      referenceNumber: true,
      idempotencyKey: true,
      externalRef: true,
      type: true,
      status: true,
      amount: true,
      description: true,
      transactionDate: true,
      createdById: true,
      updatedById: true,
      validatedById: true,
      validatedAt: true,
      validationNote: true,
      rejectedById: true,
      rejectedAt: true,
      rejectionReason: true,
      postedById: true,
      postedAt: true,
      voidedById: true,
      voidedAt: true,
      createdAt: true,
      updatedAt: true,
      cashAccount: { select: { id: true, key: true, name: true, currency: true } },
      category: { select: { id: true, type: true, key: true, name: true } },
      ledger: { select: this.ledgerSelect() },
    } satisfies Prisma.TransactionSelect;
  }

  private async findTransactionInTransaction(tx: Prisma.TransactionClient, rtId: string, transactionId: string): Promise<TransactionDbRow | null> {
    return tx.transaction.findFirst({
      where: { id: transactionId, rtId, deletedAt: null },
      select: this.transactionSelect(),
    });
  }

  private async findTransactionInTransactionOrThrow(tx: Prisma.TransactionClient, rtId: string, transactionId: string): Promise<TransactionDbRow> {
    const transaction = await this.findTransactionInTransaction(tx, rtId, transactionId);
    if (!transaction) {
      throw new BadRequestException('Transaction lifecycle state changed while processing the request.');
    }
    return transaction;
  }

  private toCashAccountRecord(account: CashAccountDbRow): CashAccountRecord {
    return {
      id: account.id,
      rtId: account.rtId,
      key: account.key,
      name: account.name,
      currency: account.currency,
      currentBalance: account.currentBalance.toString(),
      version: account.version,
      isActive: account.isActive,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private toCategoryRecord(category: CategoryDbRow): TransactionCategoryRecord {
    return {
      id: category.id,
      rtId: category.rtId,
      type: category.type,
      key: category.key,
      name: category.name,
      isSystem: category.isSystem,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toLedgerRecord(ledger: LedgerDbRow): CashLedgerRecord {
    return {
      id: ledger.id,
      rtId: ledger.rtId,
      cashAccountId: ledger.cashAccountId,
      transactionId: ledger.transactionId,
      ledgerSequence: ledger.ledgerSequence,
      entryType: ledger.entryType,
      amount: ledger.amount.toString(),
      balanceBefore: ledger.balanceBefore.toString(),
      balanceAfter: ledger.balanceAfter.toString(),
      ledgerDate: ledger.ledgerDate,
      createdAt: ledger.createdAt,
    };
  }

  private toTransactionRecord(transaction: TransactionDbRow): FinanceTransactionRecord {
    return {
      id: transaction.id,
      rtId: transaction.rtId,
      cashAccountId: transaction.cashAccountId,
      categoryId: transaction.categoryId,
      sourceCollectionId: transaction.sourceCollectionId,
      referenceNumber: transaction.referenceNumber,
      idempotencyKey: transaction.idempotencyKey,
      externalRef: transaction.externalRef,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount.toString(),
      description: transaction.description,
      transactionDate: transaction.transactionDate,
      createdById: transaction.createdById,
      updatedById: transaction.updatedById,
      validatedById: transaction.validatedById,
      validatedAt: transaction.validatedAt,
      validationNote: transaction.validationNote,
      rejectedById: transaction.rejectedById,
      rejectedAt: transaction.rejectedAt,
      rejectionReason: transaction.rejectionReason,
      postedById: transaction.postedById,
      postedAt: transaction.postedAt,
      voidedById: transaction.voidedById,
      voidedAt: transaction.voidedAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      cashAccount: transaction.cashAccount,
      category: transaction.category,
      ledger: transaction.ledger ? this.toLedgerRecord(transaction.ledger) : null,
    };
  }

  private toPaginated<T>(items: T[], page: number, limit: number, total: number): PaginatedResult<T> {
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async writeAudit(
    client: AuditClient,
    input: FinanceAuditInput,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        beforeData: input.beforeData === undefined ? undefined : this.toJson(input.beforeData),
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private assertReplayKeyMatchesInTransaction(input: {
    rtId: string;
    actor: AuthPrincipal;
    meta: FinanceRequestMeta;
    entityType: string;
    entityId: string;
    existingKey: string | null;
    requestedKey?: string;
    afterData: unknown;
  }): void {
    if (!input.requestedKey || input.existingKey === input.requestedKey) {
      return;
    }
    throw new FinanceReplayConflict({
      rtId: input.rtId,
      actor: input.actor,
      meta: input.meta,
      action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
      entityType: input.entityType,
      entityId: input.entityId,
      afterData: { ...this.objectData(input.afterData), existingKey: input.existingKey, requestedKey: input.requestedKey },
    });
  }

  private async assertReplayKeyMatchesOutside(input: {
    rtId: string;
    actor: AuthPrincipal;
    meta: FinanceRequestMeta;
    entityType: string;
    entityId: string;
    existingKey: string | null;
    requestedKey?: string;
    afterData: unknown;
  }): Promise<void> {
    if (!input.requestedKey || input.existingKey === input.requestedKey) {
      return;
    }
    await this.writeAudit(this.prisma, {
      rtId: input.rtId,
      actor: input.actor,
      meta: input.meta,
      action: 'FINANCE_IDEMPOTENCY_REPLAY_FAILED',
      entityType: input.entityType,
      entityId: input.entityId,
      afterData: { ...this.objectData(input.afterData), existingKey: input.existingKey, requestedKey: input.requestedKey },
    });
    throw new ConflictException('Idempotency replay does not match the original financial request.');
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!this.isSerializationConflict(error) || attempt === maxAttempts) {
          throw error;
        }
      }
    }
    throw new ConflictException('Serializable transaction retry budget was exhausted.');
  }

  private isSerializationConflict(error: unknown): boolean {
    return error instanceof PrismaClientKnownRequestError && error.code === 'P2034';
  }

  private isKnownConcurrencyConflict(error: unknown): boolean {
    return error instanceof PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);
  }

  private isIdempotencyUniqueConflict(error: unknown): boolean {
    if (!(error instanceof PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target = (error.meta as { target?: string[] | string } | undefined)?.target;
    const fields = Array.isArray(target) ? target : [target ?? ''];
    return fields.some((field) => String(field).toLowerCase().includes('idempotency'));
  }

  private throwKnownConflict(error: unknown, message: string): never {
    if (this.isKnownConcurrencyConflict(error)) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private objectData(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : { value };
  }
}
