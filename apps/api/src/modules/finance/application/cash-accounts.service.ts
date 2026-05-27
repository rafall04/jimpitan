/**
 * Purpose: Application service for tenant-scoped cash account management.
 * Caller: CashAccountsController and future finance workflows.
 * Deps: Finance repository port, AuthPrincipal, finance command contracts, and finance domain response types.
 * MainFuncs: Enforces tenant scope and not-found handling for cash account create/update/archive/default/balance use cases.
 * SideEffects: Writes cash account changes and audit logs through the repository.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { FINANCE_REPOSITORY } from '../finance.tokens';
import type { ArchiveCashAccountCommand, CashAccountListQuery, CreateCashAccountCommand, FinanceRequestMeta, UpdateCashAccountCommand } from './finance.commands';
import type { CashAccountBalance, CashAccountRecord } from '../domain/finance.types';
import type { FinanceRepositoryPort } from '../infrastructure/finance.repository.port';

@Injectable()
export class CashAccountsService {
  constructor(@Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepositoryPort) {}

  async listCashAccounts(actor: AuthPrincipal, query: CashAccountListQuery): Promise<PaginatedResult<CashAccountRecord>> {
    return this.repository.listCashAccounts(actor.rtId, query);
  }

  async getCashAccount(actor: AuthPrincipal, cashAccountId: string): Promise<CashAccountRecord> {
    const account = await this.repository.findCashAccountById(actor.rtId, cashAccountId);
    if (!account) {
      throw new NotFoundException('Cash account was not found.');
    }
    return account;
  }

  async getDefaultCashAccount(actor: AuthPrincipal): Promise<CashAccountRecord> {
    const account = await this.repository.findDefaultCashAccount(actor.rtId);
    if (!account) {
      throw new NotFoundException('Default cash account was not found.');
    }
    return account;
  }

  async createCashAccount(actor: AuthPrincipal, command: CreateCashAccountCommand, meta: FinanceRequestMeta): Promise<CashAccountRecord> {
    return this.repository.createCashAccount(actor.rtId, command, actor, meta);
  }

  async updateCashAccount(actor: AuthPrincipal, cashAccountId: string, command: UpdateCashAccountCommand, meta: FinanceRequestMeta): Promise<CashAccountRecord> {
    const account = await this.repository.updateCashAccount(actor.rtId, cashAccountId, command, actor, meta);
    if (!account) {
      throw new NotFoundException('Cash account was not found.');
    }
    return account;
  }

  async archiveCashAccount(actor: AuthPrincipal, cashAccountId: string, command: ArchiveCashAccountCommand, meta: FinanceRequestMeta): Promise<CashAccountRecord> {
    const account = await this.repository.archiveCashAccount(actor.rtId, cashAccountId, command, actor, meta);
    if (!account) {
      throw new NotFoundException('Cash account was not found.');
    }
    return account;
  }

  async getCashAccountBalance(actor: AuthPrincipal, cashAccountId: string): Promise<CashAccountBalance> {
    const balance = await this.repository.getCashAccountBalance(actor.rtId, cashAccountId);
    if (!balance) {
      throw new NotFoundException('Cash account was not found.');
    }
    return balance;
  }
}
