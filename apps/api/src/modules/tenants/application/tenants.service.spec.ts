/**
 * Purpose: Unit tests for tenant service isolation rules.
 * Caller: Vitest test runner.
 * Deps: TenantsService and tenant repository port.
 * MainFuncs: Verifies tenant access is scoped to the current principal and tenant lifecycle mutations require super-admin.
 * SideEffects: None.
 */
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TenantsService } from './tenants.service';
import type { TenantsRepositoryPort } from '../infrastructure/tenants.repository.port';
import type { AuthPrincipal } from '../../auth/domain/auth.types';

function createHarness() {
  const repository: TenantsRepositoryPort = {
    createTenant: vi.fn(async () => ({
      id: 'rt-2',
      name: 'RT 02',
      code: 'RT02',
      address: null,
      timezone: 'Asia/Jakarta',
      isActive: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
    findTenantById: vi.fn(async (rtId: string) => ({
      id: rtId,
      name: `Tenant ${rtId}`,
      code: rtId,
      address: null,
      timezone: 'Asia/Jakarta',
      isActive: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
    listTenants: vi.fn(async () => ({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    })),
    updateTenant: vi.fn(async () => ({
      id: 'rt-1',
      name: 'RT 01 Updated',
      code: 'RT01',
      address: null,
      timezone: 'Asia/Jakarta',
      isActive: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-02T00:00:00.000Z'),
    })),
    softDeleteTenant: vi.fn(async () => true),
  };
  const service = new TenantsService(repository);
  const principal: AuthPrincipal = {
    userId: 'user-1',
    membershipId: 'membership-1',
    rtId: 'rt-1',
    roles: ['KETUA_RT'],
    permissions: ['settings.read'],
  };

  return { repository, service, principal };
}

describe('TenantsService', () => {
  it('denies non-super-admin access to another RT', async () => {
    const { service, principal } = createHarness();

    await expect(service.getTenant(principal, 'rt-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes non-super-admin tenant listing to the current RT', async () => {
    const { service, repository, principal } = createHarness();

    await service.listTenants(principal, { page: 1, limit: 20 });

    expect(repository.listTenants).toHaveBeenCalledWith(expect.objectContaining({ rtId: 'rt-1' }));
  });

  it('denies tenant creation for non-super-admin actors', async () => {
    const { service, repository, principal } = createHarness();

    await expect(
      service.createTenant(principal, { name: 'RT 02', code: 'RT02' }, { correlationId: 'corr-create' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createTenant).not.toHaveBeenCalled();
  });

  it('denies tenant deletion for non-super-admin actors even for their current RT', async () => {
    const { service, repository, principal } = createHarness();

    await expect(service.deleteTenant(principal, 'rt-1', { correlationId: 'corr-delete' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.softDeleteTenant).not.toHaveBeenCalled();
  });
});
