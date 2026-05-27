/**
 * Purpose: Unit tests for tenant-scoped house lifecycle behavior.
 * Caller: Vitest test runner.
 * Deps: HousesService, houses repository port, AuthPrincipal.
 * MainFuncs: Verifies area validation, tenant isolation, occupancy transitions, and archive safety.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HouseStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { HousesRepositoryPort } from '../infrastructure/houses.repository.port';
import { HousesService } from './houses.service';

function createHarness() {
  const repository: HousesRepositoryPort = {
    createArea: vi.fn(),
    updateArea: vi.fn(),
    archiveArea: vi.fn(),
    findAreaById: vi.fn(async () => areaRecord()),
    listAreas: vi.fn(),
    countActiveHousesInArea: vi.fn(),
    createHouse: vi.fn(async () => houseRecord()),
    updateHouse: vi.fn(async () => houseRecord({ status: HouseStatus.EMPTY })),
    archiveHouse: vi.fn(async () => houseRecord({ status: HouseStatus.INACTIVE })),
    findHouseById: vi.fn(async () => houseRecord()),
    listHouses: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    countActiveResidentsInHouse: vi.fn(async () => 0),
  };
  const principal: AuthPrincipal = {
    userId: 'admin-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['houses.read', 'houses.manage'],
  };
  return { principal, repository, service: new HousesService(repository) };
}

describe('HousesService', () => {
  it('rejects house creation when the area is outside the current tenant', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAreaById).mockResolvedValueOnce(null);

    await expect(service.createHouse(principal, { areaId: 'area-outside', houseNumber: 'A-01' }, { correlationId: 'corr-1' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createHouse).not.toHaveBeenCalled();
  });

  it('rejects house creation when the area is archived', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAreaById).mockResolvedValueOnce(areaRecord({ isActive: false }));

    await expect(service.createHouse(principal, { areaId: 'area-1', houseNumber: 'A-01' }, { correlationId: 'corr-2' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createHouse).not.toHaveBeenCalled();
  });

  it('rejects creating an occupied house without residents', async () => {
    const { principal, repository, service } = createHarness();

    await expect(
      service.createHouse(principal, { areaId: 'area-1', houseNumber: 'A-02', status: HouseStatus.OCCUPIED }, { correlationId: 'corr-occupied-create' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createHouse).not.toHaveBeenCalled();
  });

  it('lists houses only inside the current tenant', async () => {
    const { principal, repository, service } = createHarness();

    await service.listHouses(principal, { page: 1, limit: 20, sortBy: 'houseNumber', sortDirection: 'asc' });

    expect(repository.listHouses).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, sortBy: 'houseNumber', sortDirection: 'asc' });
  });

  it('rejects archiving a house that still has active residents', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.countActiveResidentsInHouse).mockResolvedValueOnce(1);

    await expect(service.archiveHouse(principal, 'house-1', { correlationId: 'corr-3' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.archiveHouse).not.toHaveBeenCalled();
  });

  it('rejects marking a vacant house as occupied manually', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.countActiveResidentsInHouse).mockResolvedValueOnce(0);

    await expect(service.updateHouse(principal, 'house-1', { status: HouseStatus.OCCUPIED }, { correlationId: 'corr-occupied-update' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.updateHouse).not.toHaveBeenCalled();
  });
});

function areaRecord(overrides: Partial<Awaited<ReturnType<HousesRepositoryPort['findAreaById']>>> = {}) {
  return {
    id: 'area-1',
    rtId: 'rt-1',
    code: 'A',
    name: 'Blok Anggrek',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function houseRecord(overrides: Partial<Awaited<ReturnType<HousesRepositoryPort['findHouseById']>>> = {}) {
  return {
    id: 'house-1',
    rtId: 'rt-1',
    areaId: 'area-1',
    houseNumber: 'A-01',
    addressNote: null,
    status: HouseStatus.OCCUPIED,
    area: {
      id: 'area-1',
      code: 'A',
      name: 'Blok Anggrek',
      sortOrder: 1,
    },
    activeResidentCount: 1,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
