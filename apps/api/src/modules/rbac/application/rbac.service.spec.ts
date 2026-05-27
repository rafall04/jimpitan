/**
 * Purpose: Unit tests for RBAC permission evaluation.
 * Caller: Vitest test runner.
 * Deps: RbacService and permission domain contracts.
 * MainFuncs: Verifies tenant-aware all/any permission checks and membership-gated super-admin access.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { RbacService } from './rbac.service';
import type { PermissionCheckContext } from '../domain/rbac.types';

const baseContext: PermissionCheckContext = {
  userId: 'user-1',
  rtId: 'rt-1',
  membershipId: 'membership-1',
  roles: ['BENDAHARA'],
  permissions: ['transactions.read', 'transactions.create', 'reports.private.read'],
};

describe('RbacService', () => {
  const service = new RbacService();

  it('allows access when every allOf permission is present', async () => {
    await expect(
      service.canAccess(baseContext, {
        allOf: ['transactions.read', 'transactions.create'],
      }),
    ).resolves.toBe(true);
  });

  it('allows access when one anyOf permission is present', async () => {
    await expect(
      service.canAccess(baseContext, {
        anyOf: ['approvals.decide', 'reports.private.read'],
      }),
    ).resolves.toBe(true);
  });

  it('denies access when tenant membership is missing', async () => {
    await expect(
      service.canAccess(
        {
          ...baseContext,
          rtId: undefined,
          membershipId: undefined,
        },
        {
          allOf: ['transactions.read'],
        },
      ),
    ).resolves.toBe(false);
  });

  it('denies super admin access when tenant membership is missing', async () => {
    await expect(
      service.canAccess(
        {
          userId: 'super-admin',
          roles: ['SUPER_ADMIN'],
          permissions: [],
        },
        {
          allOf: ['backup.manage'],
        },
      ),
    ).resolves.toBe(false);
  });

  it('allows super admin access only after tenant membership is resolved', async () => {
    await expect(
      service.canAccess(
        {
          userId: 'super-admin',
          rtId: 'rt-1',
          membershipId: 'membership-super',
          roles: ['SUPER_ADMIN'],
          permissions: [],
        },
        {
          allOf: ['backup.manage'],
        },
      ),
    ).resolves.toBe(true);
  });
});
