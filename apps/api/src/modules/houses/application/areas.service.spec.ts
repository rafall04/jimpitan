/**
 * Purpose: Unit tests for tenant-scoped area lifecycle behavior.
 * Caller: Vitest test runner.
 * Deps: AreasService, houses repository port, AuthPrincipal.
 * MainFuncs: Verifies tenant isolation, archive safety, and audit-bearing commands.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { HousesRepositoryPort } from '../infrastructure/houses.repository.port';
import { AreasService } from './areas.service';

function createHarness() {
  const repository: HousesRepositoryPort = {
    createArea: vi.fn(async () => areaRecord()),
    updateArea: vi.fn(async () => areaRecord({ name: 'Blok Melati' })),
    archiveArea: vi.fn(async () => areaRecord({ isActive: false })),
    findAreaById: vi.fn(async () => areaRecord()),
    listAreas: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    countActiveHousesInArea: vi.fn(async () => 0),
    createHouse: vi.fn(),
    updateHouse: vi.fn(),
    archiveHouse: vi.fn(),
    findHouseById: vi.fn(),
    listHouses: vi.fn(),
    countActiveResidentsInHouse: vi.fn(),
  };
  const principal: AuthPrincipal = {
    userId: 'admin-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['areas.read', 'areas.manage'],
  };
  return { principal, repository, service: new AreasService(repository) };
}

describe('AreasService', () => {
  it('lists areas only inside the current tenant', async () => {
    const { principal, repository, service } = createHarness();

    await service.listAreas(principal, { page: 1, limit: 20, sortBy: 'sortOrder', sortDirection: 'asc' });

    expect(repository.listAreas).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, sortBy: 'sortOrder', sortDirection: 'asc' });
  });

  it('rejects updates for areas outside the current tenant', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.findAreaById).mockResolvedValueOnce(null);

    await expect(service.updateArea(principal, 'area-outside', { name: 'Outside' }, { correlationId: 'corr-1' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.updateArea).not.toHaveBeenCalled();
  });

  it('rejects archiving an area while active houses still reference it', async () => {
    const { principal, repository, service } = createHarness();
    vi.mocked(repository.countActiveHousesInArea).mockResolvedValueOnce(2);

    await expect(service.archiveArea(principal, 'area-1', { correlationId: 'corr-2' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.archiveArea).not.toHaveBeenCalled();
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
