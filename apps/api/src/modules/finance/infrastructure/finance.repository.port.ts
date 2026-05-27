/**
 * Purpose: Repository contract for tenant-scoped finance and cash-ledger persistence.
 * Caller: Finance application services.
 * Deps: AuthPrincipal, finance command contracts, domain response types, and shared pagination.
 * MainFuncs: Defines cash account, category, transaction, ledger posting, balance, and collection posting persistence boundaries.
 * SideEffects: None in the port.
 */
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
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
import type { CashAccountBalance, CashAccountRecord, FinanceTransactionRecord, SourceCollectionPostingResult, TransactionCategoryRecord } from '../domain/finance.types';

export interface FinanceRepositoryPort {
  listCashAccounts(rtId: string, query: CashAccountListQuery): Promise<PaginatedResult<CashAccountRecord>>;
  findCashAccountById(rtId: string, cashAccountId: string): Promise<CashAccountRecord | null>;
  findDefaultCashAccount(rtId: string): Promise<CashAccountRecord | null>;
  createCashAccount(rtId: string, command: CreateCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord>;
  updateCashAccount(rtId: string, cashAccountId: string, command: UpdateCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord | null>;
  archiveCashAccount(rtId: string, cashAccountId: string, command: ArchiveCashAccountCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<CashAccountRecord | null>;
  getCashAccountBalance(rtId: string, cashAccountId: string): Promise<CashAccountBalance | null>;

  listCategories(rtId: string, query: CategoryListQuery): Promise<PaginatedResult<TransactionCategoryRecord>>;
  findCategoryById(rtId: string, categoryId: string): Promise<TransactionCategoryRecord | null>;
  findSystemCategory(rtId: string, input: { key: string; type: 'INCOME' | 'EXPENSE' }): Promise<TransactionCategoryRecord | null>;
  createCategory(rtId: string, command: CreateTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord>;
  updateCategory(rtId: string, categoryId: string, command: UpdateTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord | null>;
  archiveCategory(rtId: string, categoryId: string, command: ArchiveTransactionCategoryCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord | null>;

  listTransactions(rtId: string, query: TransactionListQuery): Promise<PaginatedResult<FinanceTransactionRecord>>;
  findTransactionById(rtId: string, transactionId: string): Promise<FinanceTransactionRecord | null>;
  createIncomeDraft(rtId: string, command: CreateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord>;
  createExpenseDraft(rtId: string, command: CreateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord>;
  validateTransaction(rtId: string, transactionId: string, command: ValidateFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null>;
  rejectTransaction(rtId: string, transactionId: string, command: RejectFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null>;
  voidDraftTransaction(rtId: string, transactionId: string, command: VoidFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null>;
  postTransaction(rtId: string, transactionId: string, command: PostFinanceTransactionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<FinanceTransactionRecord | null>;
  postValidatedCollection(rtId: string, command: PostValidatedCollectionCommand, actor: AuthPrincipal, meta: FinanceRequestMeta): Promise<SourceCollectionPostingResult>;
}
