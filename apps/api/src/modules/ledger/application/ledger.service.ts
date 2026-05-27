/**
 * Purpose: Application service for tenant-scoped append-only cash ledger reads.
 * Caller: LedgerController and future finance posting workflows.
 * Deps: Ledger repository port, AuthPrincipal, ledger command contracts, and ledger domain response types.
 * MainFuncs: Enforces tenant scope and not-found handling for ledger list/detail/balance reads.
 * SideEffects: Reads ledger data through the repository.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { LEDGER_REPOSITORY } from '../ledger.tokens';
import type { LedgerEntryListQuery } from './ledger.commands';
import type { LedgerAccountBalance, LedgerEntryRecord } from '../domain/ledger.types';
import type { LedgerRepositoryPort } from '../infrastructure/ledger.repository.port';

@Injectable()
export class LedgerService {
  constructor(@Inject(LEDGER_REPOSITORY) private readonly repository: LedgerRepositoryPort) {}

  async listLedgerEntries(actor: AuthPrincipal, query: LedgerEntryListQuery): Promise<PaginatedResult<LedgerEntryRecord>> {
    return this.repository.listLedgerEntries(actor.rtId, query);
  }

  async getLedgerEntry(actor: AuthPrincipal, ledgerEntryId: string): Promise<LedgerEntryRecord> {
    const entry = await this.repository.findLedgerEntryById(actor.rtId, ledgerEntryId);
    if (!entry) {
      throw new NotFoundException('Ledger entry was not found.');
    }
    return entry;
  }

  async getCashAccountBalance(actor: AuthPrincipal, cashAccountId: string): Promise<LedgerAccountBalance> {
    const balance = await this.repository.getCashAccountBalance(actor.rtId, cashAccountId);
    if (!balance) {
      throw new NotFoundException('Cash account was not found.');
    }
    return balance;
  }
}
