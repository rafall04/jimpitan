/**
 * Purpose: Repository contract for future RBAC persistence operations.
 * Caller: Future RbacService implementation.
 * Deps: RBAC domain types.
 * MainFuncs: Defines RBAC persistence boundary without Prisma queries.
 * SideEffects: None.
 */
import type { PermissionCheckContext } from '../domain/rbac.types';

export interface RbacRepositoryPort {
  getPermissionContext(userId: string, rtId?: string): Promise<PermissionCheckContext | null>;
}
