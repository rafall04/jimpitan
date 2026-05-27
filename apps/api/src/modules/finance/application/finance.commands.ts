/**
 * Purpose: Command and query contracts for finance cash accounts, categories, transactions, and collection posting.
 * Caller: Finance controllers, services, repository ports, and future hook adapters.
 * Deps: Prisma enum types and shared pagination type.
 * MainFuncs: Defines validated finance workflow inputs and audit request metadata.
 * SideEffects: None.
 */
import type { TransactionStatus, TransactionType } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';

export type FinanceRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type FinanceSortDirection = 'asc' | 'desc';

export type CashAccountListQuery = PaginationInput & {
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'key' | 'updatedAt';
  sortDirection?: FinanceSortDirection;
};

export type CreateCashAccountCommand = {
  key?: string;
  name: string;
  currency?: string;
};

export type UpdateCashAccountCommand = {
  name?: string;
  isActive?: boolean;
};

export type ArchiveCashAccountCommand = {
  reason: string;
};

export type CategoryListQuery = PaginationInput & {
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'key' | 'updatedAt';
  sortDirection?: FinanceSortDirection;
};

export type CreateTransactionCategoryCommand = {
  type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
  key: string;
  name: string;
};

export type UpdateTransactionCategoryCommand = {
  name?: string;
  isActive?: boolean;
};

export type ArchiveTransactionCategoryCommand = {
  reason: string;
};

export type TransactionListQuery = PaginationInput & {
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE' | 'ADJUSTMENT'>;
  status?: TransactionStatus;
  cashAccountId?: string;
  categoryId?: string;
  sourceCollectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'transactionDate' | 'status' | 'updatedAt' | 'amount';
  sortDirection?: FinanceSortDirection;
};

export type CreateFinanceTransactionCommand = {
  cashAccountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
  referenceNumber?: string;
  idempotencyKey?: string;
  externalRef?: string;
  sourceCollectionId?: string;
};

export type ValidateFinanceTransactionCommand = {
  validationNote?: string;
};

export type RejectFinanceTransactionCommand = {
  rejectionReason: string;
};

export type VoidFinanceTransactionCommand = {
  voidReason: string;
};

export type PostFinanceTransactionCommand = {
  idempotencyKey?: string;
};

export type PostValidatedCollectionCommand = {
  collectionId: string;
  cashAccountId?: string;
  categoryId?: string;
  idempotencyKey?: string;
};
