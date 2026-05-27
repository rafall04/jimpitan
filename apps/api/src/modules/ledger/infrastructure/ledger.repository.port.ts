/**
 * Purpose: Repository contract for tenant-scoped append-only cash ledger reads.
 * Caller: LedgerService and future finance posting service.
 * Deps: AuthPrincipal, ledger command contracts, ledger domain types, and pagination result type.
 * MainFuncs: Defines ledger list/detail/balance persistence boundaries.
 * SideEffects: None in the port.
 */
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { LedgerEntryListQuery } from '../application/ledger.commands';
import type { LedgerAccountBalance, LedgerEntryRecord } from '../domain/ledger.types';

export interface LedgerRepositoryPort {
  listLedgerEntries(rtId: string, query: LedgerEntryListQuery): Promise<PaginatedResult<LedgerEntryRecord>>;
  findLedgerEntryById(rtId: string, ledgerEntryId: string): Promise<LedgerEntryRecord | null>;
  getCashAccountBalance(rtId: string, cashAccountId: string): Promise<LedgerAccountBalance | null>;
}
