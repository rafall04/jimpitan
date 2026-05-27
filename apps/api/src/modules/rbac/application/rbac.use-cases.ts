/**
 * Purpose: Use-case contract for future RBAC application behavior.
 * Caller: Future permission guard and RBAC controller.
 * Deps: RBAC domain types.
 * MainFuncs: Defines permission evaluation surface without access decision logic.
 * SideEffects: None.
 */
import type { PermissionCheckContext, PermissionRequirement } from '../domain/rbac.types';

export interface RbacUseCases {
  canAccess(context: PermissionCheckContext, requirement: PermissionRequirement): Promise<boolean>;
}
