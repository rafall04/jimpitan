/**
 * Purpose: Unit tests for tenant-scoped jimpitan collection workflow rules.
 * Caller: Vitest test runner.
 * Deps: JimpitanService, mocked repository and hook ports, AuthPrincipal.
 * MainFuncs: Verifies lifecycle validation, mode contracts, tenant isolation, duplicate prevention, officer ownership, and finance-hook decoupling.
 * SideEffects: None.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JimpitanService } from './jimpitan.service';
import type { AuthPrincipal } from '../../auth/domain/auth.types';

function createHarness() {
  const repository = {
    listCollections: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
    findCollectionById: vi.fn(async () => collectionRecord()),
    findOfficerMembership: vi.fn(async () => ({ id: 'membership-officer', rtId: 'rt-1', status: 'ACTIVE' })),
    findArea: vi.fn(async () => ({ id: 'area-1', rtId: 'rt-1', isActive: true })),
    hasActiveCollectionForRouteDate: vi.fn(async () => false),
    createCollection: vi.fn(async () => collectionRecord()),
    updateCollection: vi.fn(async () => collectionRecord({ note: 'Updated' })),
    startCollection: vi.fn(async () => collectionRecord({ status: 'IN_PROGRESS' })),
    cancelCollection: vi.fn(async () => collectionRecord({ status: 'CANCELLED' })),
    getChecklist: vi.fn(async () => ({ collection: collectionRecord(), houses: [] })),
    generateChecklist: vi.fn(async () => ({ collection: collectionRecord({ status: 'IN_PROGRESS' }), houses: [] })),
    upsertCollectionItems: vi.fn(async () => collectionRecord({ status: 'IN_PROGRESS' })),
    setBulkCollectionTotal: vi.fn(async () => collectionRecord({ collectionMode: 'BULK_TOTAL', status: 'IN_PROGRESS', totalAmount: '75000' })),
    submitCollection: vi.fn(async () => collectionRecord({ status: 'SUBMITTED' })),
    validateCollection: vi.fn(async () => collectionRecord({ status: 'VALIDATED' })),
    rejectCollection: vi.fn(async () => collectionRecord({ status: 'REJECTED' })),
    getCollectionSummary: vi.fn(async () => collectionSummary()),
    getOutstandingHouses: vi.fn(async () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 })),
  };
  const hooks = {
    collectionAssigned: vi.fn(async () => undefined),
    collectionSubmitted: vi.fn(async () => undefined),
    collectionValidated: vi.fn(async () => undefined),
    collectionRejected: vi.fn(async () => undefined),
  };
  const principal: AuthPrincipal = {
    userId: 'admin-1',
    membershipId: 'membership-admin',
    rtId: 'rt-1',
    roles: ['BENDAHARA'],
    permissions: ['collections.read', 'collections.create', 'collections.update_own', 'collections.submit_own', 'collections.validate', 'collections.reject'],
  };
  const officer: AuthPrincipal = {
    ...principal,
    membershipId: 'membership-officer',
    roles: ['PETUGAS'],
    permissions: ['collections.read', 'collections.update_own', 'collections.submit_own'],
  };
  const service = new JimpitanService(repository as never, hooks);

  return { hooks, officer, principal, repository, service };
}

describe('JimpitanService', () => {
  it('lists collections only inside the current tenant', async () => {
    const { principal, repository, service } = createHarness();

    await service.listCollections(principal, { page: 1, limit: 20, status: 'DRAFT' });

    expect(repository.listCollections).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20, status: 'DRAFT' });
  });

  it('rejects collection creation when officer membership is outside the current tenant', async () => {
    const { principal, repository, service } = createHarness();
    repository.findOfficerMembership.mockResolvedValueOnce(null as never);

    await expect(
      service.createCollection(principal, { officerMembershipId: 'membership-outside', collectionDate: '2030-01-01', areaId: 'area-1' }, { correlationId: 'corr-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createCollection).not.toHaveBeenCalled();
  });

  it('rejects duplicate active collection sessions for the same route and date', async () => {
    const { principal, repository, service } = createHarness();
    repository.hasActiveCollectionForRouteDate.mockResolvedValueOnce(true);

    await expect(
      service.createCollection(principal, { officerMembershipId: 'membership-officer', collectionDate: '2030-01-01', areaId: 'area-1' }, { correlationId: 'corr-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createCollection).not.toHaveBeenCalled();
  });

  it('rejects collection creation for archived route areas', async () => {
    const { principal, repository, service } = createHarness();
    repository.findArea.mockResolvedValueOnce({ id: 'area-1', rtId: 'rt-1', isActive: false });

    await expect(
      service.createCollection(principal, { officerMembershipId: 'membership-officer', collectionDate: '2030-01-01', areaId: 'area-1' }, { correlationId: 'corr-archived-area' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createCollection).not.toHaveBeenCalled();
  });

  it('generates checklist for the assigned officer and moves the session forward', async () => {
    const { officer, repository, service } = createHarness();

    const checklist = await service.generateChecklist(officer, 'collection-1', { correlationId: 'corr-checklist' });

    expect(repository.generateChecklist).toHaveBeenCalledWith('rt-1', 'collection-1', officer, { correlationId: 'corr-checklist' });
    expect(checklist.collection.status).toBe('IN_PROGRESS');
  });

  it('rejects checklist generation for bulk total sessions', async () => {
    const { officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL' }));

    await expect(service.generateChecklist(officer, 'collection-1', { correlationId: 'corr-bulk-checklist' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.generateChecklist).not.toHaveBeenCalled();
  });

  it('rejects duplicate house entries in a batch item submission', async () => {
    const { officer, repository, service } = createHarness();

    await expect(
      service.upsertCollectionItems(
        officer,
        'collection-1',
        {
          items: [
            { houseId: 'house-1', amount: '2000', status: 'PAID' },
            { houseId: 'house-1', amount: '0', status: 'UNPAID' },
          ],
        },
        { correlationId: 'corr-3' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertCollectionItems).not.toHaveBeenCalled();
  });

  it('rejects non-paid collection items that carry collected amount', async () => {
    const { officer, repository, service } = createHarness();

    await expect(
      service.upsertCollectionItems(officer, 'collection-1', { items: [{ houseId: 'house-1', amount: '2000', status: 'UNPAID' }] }, { correlationId: 'corr-amount' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertCollectionItems).not.toHaveBeenCalled();
  });

  it('rejects editing collection items after validation', async () => {
    const { officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ status: 'VALIDATED' }));

    await expect(
      service.upsertCollectionItems(officer, 'collection-1', { items: [{ houseId: 'house-1', amount: '2000', status: 'PAID' }] }, { correlationId: 'corr-4' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.upsertCollectionItems).not.toHaveBeenCalled();
  });

  it('saves bulk total amounts without collection item input', async () => {
    const { officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL' }));

    const result = await service.setBulkCollectionTotal(officer, 'collection-1', { totalAmount: '75000', note: 'Route total' }, { correlationId: 'corr-bulk-total' });

    expect(repository.setBulkCollectionTotal).toHaveBeenCalledWith('rt-1', 'collection-1', { totalAmount: '75000', note: 'Route total' }, officer, { correlationId: 'corr-bulk-total' });
    expect(result.totalAmount).toBe('75000');
  });

  it('rejects bulk total amounts that are not positive integer currency', async () => {
    const { officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL' }));

    await expect(service.setBulkCollectionTotal(officer, 'collection-1', { totalAmount: '0' }, { correlationId: 'corr-bulk-invalid' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.setBulkCollectionTotal).not.toHaveBeenCalled();
  });

  it('rejects submission by a non-assigned officer without validator permission', async () => {
    const { repository, service } = createHarness();
    const wrongOfficer: AuthPrincipal = {
      userId: 'officer-2',
      membershipId: 'membership-other',
      rtId: 'rt-1',
      roles: ['PETUGAS'],
      permissions: ['collections.submit_own'],
    };

    await expect(service.submitCollection(wrongOfficer, 'collection-1', { submitRequestId: 'submit-1' }, { correlationId: 'corr-5' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.submitCollection).not.toHaveBeenCalled();
  });

  it('submits bulk total sessions without requiring house items', async () => {
    const { hooks, officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL', totalAmount: '75000', itemCount: 0 }));
    repository.submitCollection.mockResolvedValueOnce(collectionRecord({ collectionMode: 'BULK_TOTAL', status: 'SUBMITTED', totalAmount: '75000', itemCount: 0 }));

    await service.submitCollection(officer, 'collection-1', { submitRequestId: 'submit-bulk' }, { correlationId: 'corr-bulk-submit' });

    expect(repository.submitCollection).toHaveBeenCalled();
    expect(hooks.collectionSubmitted).toHaveBeenCalledWith(expect.objectContaining({ collectionMode: 'BULK_TOTAL' }));
  });

  it('keeps per-house submission blocked until at least one item exists', async () => {
    const { officer, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ collectionMode: 'PER_HOUSE', itemCount: 0, totalAmount: '0' }));

    await expect(service.submitCollection(officer, 'collection-1', { submitRequestId: 'submit-empty' }, { correlationId: 'corr-empty-submit' })).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.submitCollection).not.toHaveBeenCalled();
  });

  it('rejects validation unless the collection is submitted', async () => {
    const { principal, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ status: 'IN_PROGRESS' }));

    await expect(service.validateCollection(principal, 'collection-1', { validationNote: 'OK' }, { correlationId: 'corr-6' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.validateCollection).not.toHaveBeenCalled();
  });

  it('validates submitted collections through the finance hook boundary', async () => {
    const { hooks, principal, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ status: 'SUBMITTED', itemCount: 1, totalAmount: '2000' }));

    await service.validateCollection(principal, 'collection-1', { validationNote: 'OK' }, { correlationId: 'corr-7' });

    expect(repository.validateCollection).toHaveBeenCalled();
    expect(hooks.collectionValidated).toHaveBeenCalledWith(expect.objectContaining({ collectionId: 'collection-1', rtId: 'rt-1' }));
  });

  it('rejects submitted collections through a workflow hook without finance posting', async () => {
    const { hooks, principal, repository, service } = createHarness();
    repository.findCollectionById.mockResolvedValueOnce(collectionRecord({ status: 'SUBMITTED' }));

    await service.rejectCollection(principal, 'collection-1', { rejectionReason: 'Needs correction' }, { correlationId: 'corr-8' });

    expect(repository.rejectCollection).toHaveBeenCalled();
    expect(hooks.collectionRejected).toHaveBeenCalledWith(expect.objectContaining({ collectionId: 'collection-1', rtId: 'rt-1' }));
  });
});

function collectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'collection-1',
    rtId: 'rt-1',
    scheduleId: 'schedule-1',
    officerMembershipId: 'membership-officer',
    collectionDate: new Date('2030-01-01T00:00:00.000Z'),
    status: 'DRAFT',
    note: null,
    totalAmount: '0',
    submittedAt: null,
    validatedAt: null,
    rejectedAt: null,
    validationNote: null,
    rejectionReason: null,
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    officer: { membershipId: 'membership-officer', userId: 'officer-1', fullName: 'Petugas Satu' },
    route: { areaId: 'area-1', areaCode: 'A', areaName: 'Blok A' },
    itemCount: 0,
    collectionMode: 'PER_HOUSE',
    ...overrides,
  };
}

function collectionSummary() {
  return {
    collectionId: 'collection-1',
    totalCollected: '0',
    totalHouses: 0,
    completedHouses: 0,
    outstandingHouses: 0,
    paidHouses: 0,
    perArea: [],
  };
}
