/**
 * Purpose: Unit tests for tenant-scoped transaction category management rules.
 * Caller: Vitest test runner.
 * Deps: TransactionCategoriesService, mocked finance repository port, AuthPrincipal.
 * MainFuncs: Verifies tenant scoping, category CRUD delegation, and not-found handling.
 * SideEffects: None.
 */
import { NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { TransactionCategoriesService } from './transaction-categories.service';

function createHarness() {
  const repository = {
    listCategories: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    findCategoryById: vi.fn(async () => categoryRecord()),
    createCategory: vi.fn(async () => categoryRecord({ key: 'donation', name: 'Donasi' })),
    updateCategory: vi.fn(async () => categoryRecord({ name: 'Donasi Warga' })),
    archiveCategory: vi.fn(async () => categoryRecord({ isActive: false })),
  };
  const principal: AuthPrincipal = { userId: 'user-1', membershipId: 'membership-1', rtId: 'rt-1', roles: ['BENDAHARA'], permissions: ['transactions.read'] };
  const service = new (TransactionCategoriesService as any)(repository);
  return { principal, repository, service };
}

describe('TransactionCategoriesService', () => {
  it('passes the current tenant to list, create, update, and archive operations', async () => {
    const { principal, repository, service } = createHarness();

    await service.listCategories(principal, { page: 1, limit: 20, type: TransactionType.INCOME });
    await service.createCategory(principal, { type: TransactionType.INCOME, key: 'donation', name: 'Donasi' }, { correlationId: 'corr-1' });
    await service.updateCategory(principal, 'category-1', { name: 'Donasi Warga' }, { correlationId: 'corr-2' });
    await service.archiveCategory(principal, 'category-1', { reason: 'Unused' }, { correlationId: 'corr-3' });

    expect(repository.listCategories).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, type: TransactionType.INCOME });
    expect(repository.createCategory).toHaveBeenCalledWith('rt-1', { type: TransactionType.INCOME, key: 'donation', name: 'Donasi' }, principal, { correlationId: 'corr-1' });
    expect(repository.updateCategory).toHaveBeenCalledWith('rt-1', 'category-1', { name: 'Donasi Warga' }, principal, { correlationId: 'corr-2' });
    expect(repository.archiveCategory).toHaveBeenCalledWith('rt-1', 'category-1', { reason: 'Unused' }, principal, { correlationId: 'corr-3' });
  });

  it('returns not found when a scoped category does not exist', async () => {
    const { principal, repository, service } = createHarness();
    repository.findCategoryById.mockResolvedValueOnce(null as never);

    await expect(service.getCategory(principal, 'outside-category')).rejects.toBeInstanceOf(NotFoundException);
  });
});

function categoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'category-1',
    rtId: 'rt-1',
    type: TransactionType.INCOME,
    key: 'jimpitan',
    name: 'Jimpitan',
    isSystem: false,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
