/**
 * Purpose: Application service for RBAC permission checks.
 * Caller: PermissionGuard, RbacController, and unit tests.
 * Deps: RBAC domain contracts.
 * MainFuncs: Evaluates tenant-aware allOf/anyOf permission requirements.
 * SideEffects: None.
 */
import { Injectable } from '@nestjs/common';
import type { RbacUseCases } from './rbac.use-cases';
import type { PermissionCheckContext, PermissionRequirement } from '../domain/rbac.types';

@Injectable()
export class RbacService implements RbacUseCases {
  async canAccess(context: PermissionCheckContext, requirement: PermissionRequirement): Promise<boolean> {
    if (!context.rtId || !context.membershipId) {
      return false;
    }

    if (context.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const allOf = requirement.allOf ?? [];
    const anyOf = requirement.anyOf ?? [];
    const permissionSet = new Set(context.permissions);

    const hasAllRequired = allOf.every((permission) => permissionSet.has(permission));
    const hasAnyRequired = anyOf.length === 0 || anyOf.some((permission) => permissionSet.has(permission));

    return hasAllRequired && hasAnyRequired;
  }
}
