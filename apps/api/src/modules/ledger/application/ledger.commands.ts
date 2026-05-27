/**
 * Purpose: Command and query contracts for append-only cash ledger reads and future posting.
 * Caller: LedgerController, LedgerService, and future repository adapters.
 * Deps: Shared pagination type.
 * MainFuncs: Defines tenant-scoped ledger query, balance, and audit request metadata inputs.
 * SideEffects: None.
 */
import type { PaginationInput } from '../../../common/types/paginated-result.type';

export type LedgerRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type LedgerSortDirection = 'asc' | 'desc';

export type LedgerEntryListQuery = PaginationInput & {
  cashAccountId?: string;
  transactionId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDirection?: LedgerSortDirection;
};
