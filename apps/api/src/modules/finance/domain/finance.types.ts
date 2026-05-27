/**
 * Purpose: Finance domain response and workflow types.
 * Caller: Finance services, controllers, repository ports, and future collection posting hooks.
 * Deps: Prisma enum types.
 * MainFuncs: Defines safe tenant-scoped cash account, category, transaction, ledger, balance, and mode-aware posting shapes.
 * SideEffects: None.
 */
import type { LedgerEntryType, TransactionStatus, TransactionType } from '@prisma/client';
import type { CollectionMode } from '../../jimpitan/domain/collection-mode.types';

export type CashAccountRecord = {
  id: string;
  rtId: string;
  key: string;
  name: string;
  currency: string;
  currentBalance: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TransactionCategoryRecord = {
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

export type CashLedgerRecord = {
  id: string;
  rtId: string;
  cashAccountId: string;
  transactionId: string;
  ledgerSequence: number;
  entryType: LedgerEntryType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  ledgerDate: Date;
  createdAt: Date;
};

export type FinanceTransactionRecord = {
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
  amount: string;
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
  cashAccount: Pick<CashAccountRecord, 'id' | 'key' | 'name' | 'currency'>;
  category: Pick<TransactionCategoryRecord, 'id' | 'type' | 'key' | 'name'>;
  ledger: CashLedgerRecord | null;
};

export type CashAccountBalance = {
  cashAccountId: string;
  balance: string;
  ledgerSequence: number;
  calculatedAt: Date;
};

export type SourceCollectionPostingResult = {
  collectionId: string;
  collectionMode?: CollectionMode;
  collectionTotalAmount?: string;
  transaction: FinanceTransactionRecord;
  ledger: CashLedgerRecord;
};
