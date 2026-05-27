/**
 * Purpose: Ledger domain response and posting types.
 * Caller: Ledger service, repository port, and future finance posting implementation.
 * Deps: Prisma ledger entry enum.
 * MainFuncs: Defines append-only cash ledger entry and sequence/balance response shapes.
 * SideEffects: None.
 */
import type { LedgerEntryType } from '@prisma/client';

export type LedgerEntryRecord = {
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

export type LedgerAccountBalance = {
  cashAccountId: string;
  balance: string;
  latestLedgerSequence: number;
  calculatedAt: Date;
};

export type AppendLedgerEntryInput = {
  rtId: string;
  cashAccountId: string;
  transactionId: string;
  entryType: LedgerEntryType;
  amount: string;
  ledgerDate: Date;
};
