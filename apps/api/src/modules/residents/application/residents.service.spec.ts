/**
 * Purpose: Unit tests for tenant-scoped resident lifecycle behavior.
 * Caller: Vitest test runner.
 * Deps: ResidentsService, resident repository port, AuthPrincipal.
 * MainFuncs: Verifies house validation, tenant isolation, move/archive/reactivate safety, and query scoping.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HouseStatus, ResidentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { ResidentsRepositoryPort } from '../infrastructure/residents.repository.port';
import { ResidentsService } from './residents.service';

function createHarness() {
  const repository: ResidentsRepositoryPort = {
    createResident: vi.fn(async () => residentRecord()),
    updateResident: vi.fn(async () => residentRecord({ fullName: 'Updated Resident' })),
    archiveResident: vi.fn(async () => residentRecord({ status: ResidentStatus.INACTIVE })),
    reactivateResident: vi.fn(async () => residentRecord({ status: ResidentStatus.ACTIVE })),
    moveResident: vi.fn(async () => residentRecord({ houseId: 'house-2' })),
    findResidentById: vi.fn(async () => residentRecord()),
    listResidents: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    findAssignableHouse: vi.fn(async () => houseRecord()),
    findTelegramAccount: vi.fn(async () => ({ id: 'telegram-1', revokedAt: null })),
    findConflictingTelegramBinding: vi.fn(async () => null),
  };
  const principal: AuthPrincipal = {
    userId: 'admin-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['residents.read', 'residents.create', 'residents.update', 'residents.delete'],
  };
  return { principal, repository, service: new ResidentsService(repository) };
}

describe('ResidentsService', () => {
  it('lists residents only inside the current tenant', async () => {
    const { principal, repository, service } = createHarness();

    await service.listResidents(principal, { page: 1, limit: 20, sortBy: 'fullName', sortDirection: 'asc' });

    expect(repository.listResidents).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, sortBy: 'fullName', sortDirection: 'asc' });
  });

  it('rejects resident creation when the target house is outside the current tenant', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAssignableHouse).mockResolvedValueOnce(null);

    await expect(service.createResident(principal, { houseId: 'house-outside', fullName: 'Outside' }, { correlationId: 'corr-1' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createResident).not.toHaveBeenCalled();
  });

  it('rejects resident creation when the target house is archived or inactive', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAssignableHouse).mockResolvedValueOnce(houseRecord({ status: HouseStatus.INACTIVE }));

    await expect(service.createResident(principal, { houseId: 'house-1', fullName: 'Inactive House' }, { correlationId: 'corr-2' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createResident).not.toHaveBeenCalled();
  });

  it('rejects resident moves to an archived target house', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAssignableHouse).mockResolvedValueOnce(houseRecord({ status: HouseStatus.INACTIVE }));

    await expect(service.moveResident(principal, 'resident-1', { houseId: 'house-2' }, { correlationId: 'corr-3' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.moveResident).not.toHaveBeenCalled();
  });

  it('rejects resident moves when the resident is not active', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findResidentById).mockResolvedValueOnce(residentRecord({ status: ResidentStatus.INACTIVE }));

    await expect(service.moveResident(principal, 'resident-1', { houseId: 'house-2' }, { correlationId: 'corr-inactive-move' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.moveResident).not.toHaveBeenCalled();
  });

  it('rejects reactivation when the resident house is no longer assignable', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findResidentById).mockResolvedValueOnce(residentRecord({ status: ResidentStatus.INACTIVE }));
    vi.mocked(repository.findAssignableHouse).mockResolvedValueOnce(null);

    await expect(service.reactivateResident(principal, 'resident-1', { correlationId: 'corr-4' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.reactivateResident).not.toHaveBeenCalled();
  });

  it('rejects reactivation when the resident is already active', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findResidentById).mockResolvedValueOnce(residentRecord({ status: ResidentStatus.ACTIVE }));

    await expect(service.reactivateResident(principal, 'resident-1', { correlationId: 'corr-active-reactivate' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.reactivateResident).not.toHaveBeenCalled();
  });

  it('rejects telegram binding when the account does not exist', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findTelegramAccount).mockResolvedValueOnce(null);

    await expect(
      service.createResident(principal, { houseId: 'house-1', fullName: 'Resident', telegramAccountId: 'telegram-missing' }, { correlationId: 'corr-5' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createResident).not.toHaveBeenCalled();
  });
});

function houseRecord(overrides: Partial<Awaited<ReturnType<ResidentsRepositoryPort['findAssignableHouse']>>> = {}) {
  return {
    id: 'house-1',
    rtId: 'rt-1',
    status: HouseStatus.OCCUPIED,
    deletedAt: null,
    ...overrides,
  };
}

function residentRecord(overrides: Partial<Awaited<ReturnType<ResidentsRepositoryPort['findResidentById']>>> = {}) {
  return {
    id: 'resident-1',
    rtId: 'rt-1',
    houseId: 'house-1',
    fullName: 'Resident Name',
    phone: null,
    status: ResidentStatus.ACTIVE,
    defaultJimpitanAmount: '2000',
    telegramAccountId: null,
    notes: null,
    house: {
      id: 'house-1',
      houseNumber: 'A-01',
      status: HouseStatus.OCCUPIED,
      area: {
        id: 'area-1',
        code: 'A',
        name: 'Blok Anggrek',
      },
    },
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
