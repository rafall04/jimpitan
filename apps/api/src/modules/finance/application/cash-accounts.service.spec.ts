/**
 * Purpose: Unit tests for tenant-scoped cash account management rules.
 * Caller: Vitest test runner.
 * Deps: CashAccountsService, mocked finance repository port, AuthPrincipal.
 * MainFuncs: Verifies tenant scoping, default account lookup, archive safety delegation, and not-found handling.
 * SideEffects: None.
 */
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { CashAccountsService } from './cash-accounts.service';

function createHarness() {
  const repository = {
    listCashAccounts: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    findCashAccountById: vi.fn(async () => cashAccountRecord()),
    findDefaultCashAccount: vi.fn(async () => cashAccountRecord()),
    createCashAccount: vi.fn(async () => cashAccountRecord({ key: 'bank', name: 'Bank RT' })),
    updateCashAccount: vi.fn(async () => cashAccountRecord({ name: 'Kas Baru' })),
    archiveCashAccount: vi.fn(async () => cashAccountRecord({ isActive: false })),
    getCashAccountBalance: vi.fn(async () => ({ cashAccountId: 'account-1', balance: '10000', ledgerSequence: 3, calculatedAt: new Date('2030-01-01T00:00:00.000Z') })),
  };
  const principal: AuthPrincipal = { userId: 'user-1', membershipId: 'membership-1', rtId: 'rt-1', roles: ['BENDAHARA'], permissions: ['transactions.read'] };
  const service = new (CashAccountsService as any)(repository);
  return { principal, repository, service };
}

describe('CashAccountsService', () => {
  it('passes the current tenant to list, create, update, archive, and balance operations', async () => {
    const { principal, repository, service } = createHarness();

    await service.listCashAccounts(principal, { page: 1, limit: 20 });
    await service.createCashAccount(principal, { key: 'bank', name: 'Bank RT' }, { correlationId: 'corr-1' });
    await service.updateCashAccount(principal, 'account-1', { name: 'Kas Baru' }, { correlationId: 'corr-2' });
    await service.archiveCashAccount(principal, 'account-1', { reason: 'Closed' }, { correlationId: 'corr-3' });
    await service.getCashAccountBalance(principal, 'account-1');

    expect(repository.listCashAccounts).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20 });
    expect(repository.createCashAccount).toHaveBeenCalledWith('rt-1', { key: 'bank', name: 'Bank RT' }, principal, { correlationId: 'corr-1' });
    expect(repository.updateCashAccount).toHaveBeenCalledWith('rt-1', 'account-1', { name: 'Kas Baru' }, principal, { correlationId: 'corr-2' });
    expect(repository.archiveCashAccount).toHaveBeenCalledWith('rt-1', 'account-1', { reason: 'Closed' }, principal, { correlationId: 'corr-3' });
    expect(repository.getCashAccountBalance).toHaveBeenCalledWith('rt-1', 'account-1');
  });

  it('returns not found when a scoped cash account does not exist', async () => {
    const { principal, repository, service } = createHarness();
    repository.findCashAccountById.mockResolvedValueOnce(null as never);

    await expect(service.getCashAccount(principal, 'outside-account')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns not found when the default cash account does not exist', async () => {
    const { principal, repository, service } = createHarness();
    repository.findDefaultCashAccount.mockResolvedValueOnce(null as never);

    await expect(service.getDefaultCashAccount(principal)).rejects.toBeInstanceOf(NotFoundException);
  });
});

function cashAccountRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    rtId: 'rt-1',
    key: 'main',
    name: 'Kas Utama',
    currency: 'IDR',
    currentBalance: '0',
    version: 1,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
