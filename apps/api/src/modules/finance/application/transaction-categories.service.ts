/**
 * Purpose: Application service for tenant-scoped transaction category management.
 * Caller: TransactionCategoriesController and future finance workflows.
 * Deps: Finance repository port, AuthPrincipal, finance command contracts, and finance domain response types.
 * MainFuncs: Enforces tenant scope and not-found handling for category create/update/archive/list/detail use cases.
 * SideEffects: Writes category changes and audit logs through the repository.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { FINANCE_REPOSITORY } from '../finance.tokens';
import type {
  ArchiveTransactionCategoryCommand,
  CategoryListQuery,
  CreateTransactionCategoryCommand,
  FinanceRequestMeta,
  UpdateTransactionCategoryCommand,
} from './finance.commands';
import type { TransactionCategoryRecord } from '../domain/finance.types';
import type { FinanceRepositoryPort } from '../infrastructure/finance.repository.port';

@Injectable()
export class TransactionCategoriesService {
  constructor(@Inject(FINANCE_REPOSITORY) private readonly repository: FinanceRepositoryPort) {}

  async listCategories(actor: AuthPrincipal, query: CategoryListQuery): Promise<PaginatedResult<TransactionCategoryRecord>> {
    return this.repository.listCategories(actor.rtId, query);
  }

  async getCategory(actor: AuthPrincipal, categoryId: string): Promise<TransactionCategoryRecord> {
    const category = await this.repository.findCategoryById(actor.rtId, categoryId);
    if (!category) {
      throw new NotFoundException('Transaction category was not found.');
    }
    return category;
  }

  async createCategory(actor: AuthPrincipal, command: CreateTransactionCategoryCommand, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord> {
    return this.repository.createCategory(actor.rtId, command, actor, meta);
  }

  async updateCategory(actor: AuthPrincipal, categoryId: string, command: UpdateTransactionCategoryCommand, meta: FinanceRequestMeta): Promise<TransactionCategoryRecord> {
    const category = await this.repository.updateCategory(actor.rtId, categoryId, command, actor, meta);
    if (!category) {
      throw new NotFoundException('Transaction category was not found.');
    }
    return category;
  }

  async archiveCategory(
    actor: AuthPrincipal,
    categoryId: string,
    command: ArchiveTransactionCategoryCommand,
    meta: FinanceRequestMeta,
  ): Promise<TransactionCategoryRecord> {
    const category = await this.repository.archiveCategory(actor.rtId, categoryId, command, actor, meta);
    if (!category) {
      throw new NotFoundException('Transaction category was not found.');
    }
    return category;
  }
}
