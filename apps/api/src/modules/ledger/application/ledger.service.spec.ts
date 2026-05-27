/**
 * Purpose: Unit tests for tenant-scoped append-only ledger read rules.
 * Caller: Vitest test runner.
 * Deps: LedgerService, mocked ledger repository port, AuthPrincipal.
 * MainFuncs: Verifies tenant scoping, balance delegation, and not-found handling.
 * SideEffects: None.
 */
import { NotFoundException } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { LedgerService } from './ledger.service';

function createHarness() {
  const repository = {
    listLedgerEntries: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    findLedgerEntryById: vi.fn(async () => ledgerRecord()),
    getCashAccountBalance: vi.fn(async () => ({ cashAccountId: 'account-1', balance: '10000', latestLedgerSequence: 1, calculatedAt: new Date('2030-01-01T00:00:00.000Z') })),
  };
  const principal: AuthPrincipal = { userId: 'user-1', membershipId: 'membership-1', rtId: 'rt-1', roles: ['BENDAHARA'], permissions: ['transactions.read'] };
  const service = new (LedgerService as any)(repository);
  return { principal, repository, service };
}

describe('LedgerService', () => {
  it('passes the current tenant to ledger read and balance operations', async () => {
    const { principal, repository, service } = createHarness();

    await service.listLedgerEntries(principal, { page: 1, limit: 20, cashAccountId: 'account-1' });
    await service.getCashAccountBalance(principal, 'account-1');

    expect(repository.listLedgerEntries).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, cashAccountId: 'account-1' });
    expect(repository.getCashAccountBalance).toHaveBeenCalledWith('rt-1', 'account-1');
  });

  it('returns not found when a scoped ledger entry does not exist', async () => {
    const { principal, repository, service } = createHarness();
    repository.findLedgerEntryById.mockResolvedValueOnce(null as never);

    await expect(service.getLedgerEntry(principal, 'outside-ledger')).rejects.toBeInstanceOf(NotFoundException);
  });
});

function ledgerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ledger-1',
    rtId: 'rt-1',
    cashAccountId: 'account-1',
    transactionId: 'transaction-1',
    ledgerSequence: 1,
    entryType: LedgerEntryType.INCREASE,
    amount: '10000',
    balanceBefore: '0',
    balanceAfter: '10000',
    ledgerDate: new Date('2030-01-01T00:00:00.000Z'),
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
