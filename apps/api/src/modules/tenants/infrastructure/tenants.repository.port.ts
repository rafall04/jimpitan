/**
 * Purpose: Repository contract for tenant persistence operations.
 * Caller: TenantsService.
 * Deps: Pagination and tenant domain types.
 * MainFuncs: Defines RT CRUD persistence boundary without exposing Prisma to the application layer.
 * SideEffects: None.
 */
import type { PaginatedResult, PaginationInput } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateTenantCommand, TenantRequestMeta, UpdateTenantCommand } from '../application/tenants.commands';
import type { TenantListScope, TenantRecord } from '../domain/tenant.types';

export interface TenantsRepositoryPort {
  createTenant(command: CreateTenantCommand, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<TenantRecord>;
  findTenantById(rtId: string): Promise<TenantRecord | null>;
  listTenants(scope: TenantListScope & PaginationInput): Promise<PaginatedResult<TenantRecord>>;
  updateTenant(rtId: string, command: UpdateTenantCommand, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<TenantRecord | null>;
  softDeleteTenant(rtId: string, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<boolean>;
}
