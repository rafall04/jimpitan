/**
 * Purpose: Decorator for attaching permission requirements to future protected routes.
 * Caller: Future controllers requiring RBAC checks.
 * Deps: NestJS SetMetadata, RBAC permission types, metadata constants.
 * MainFuncs: Stores required permission metadata for future guards.
 * SideEffects: Adds metadata to route handlers/classes.
 */
import { SetMetadata } from '@nestjs/common';
import { PERMISSION_REQUIREMENT_METADATA } from '../constants/metadata.constants';
import type { PermissionKey } from '../../modules/rbac/domain/permission.constants';
import type { PermissionRequirement } from '../../modules/rbac/domain/rbac.types';

export function RequirePermissions(requirement: PermissionRequirement) {
  return SetMetadata(PERMISSION_REQUIREMENT_METADATA, requirement);
}

export function RequireAnyPermission(...permissions: PermissionKey[]) {
  return RequirePermissions({ anyOf: permissions });
}

export function RequireAllPermissions(...permissions: PermissionKey[]) {
  return RequirePermissions({ allOf: permissions });
}
