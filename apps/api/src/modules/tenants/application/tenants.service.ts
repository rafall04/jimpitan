/**
 * Purpose: Application service for RT tenant foundation use cases.
 * Caller: TenantsController and unit tests.
 * Deps: Tenant repository port, AuthPrincipal, pagination types.
 * MainFuncs: Enforces tenant access boundaries and delegates RT CRUD persistence.
 * SideEffects: Writes RT tenant data through the repository port.
 */
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationInput, PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { TENANTS_REPOSITORY } from '../tenants.tokens';
import type { TenantRecord } from '../domain/tenant.types';
import type { CreateTenantCommand, TenantRequestMeta, UpdateTenantCommand } from './tenants.commands';
import type { TenantsRepositoryPort } from '../infrastructure/tenants.repository.port';

@Injectable()
export class TenantsService {
  constructor(@Inject(TENANTS_REPOSITORY) private readonly tenantsRepository: TenantsRepositoryPort) {}

  async createTenant(actor: AuthPrincipal, command: CreateTenantCommand, meta: TenantRequestMeta): Promise<TenantRecord> {
    this.assertSuperAdmin(actor);
    return this.tenantsRepository.createTenant(command, actor, meta);
  }

  async listTenants(actor: AuthPrincipal, pagination: PaginationInput): Promise<PaginatedResult<TenantRecord>> {
    return this.tenantsRepository.listTenants({
      includeAll: this.isSuperAdmin(actor),
      rtId: this.isSuperAdmin(actor) ? undefined : actor.rtId,
      ...pagination,
    });
  }

  async getCurrentTenant(actor: AuthPrincipal): Promise<TenantRecord> {
    return this.getTenant(actor, actor.rtId);
  }

  async getTenant(actor: AuthPrincipal, rtId: string): Promise<TenantRecord> {
    this.assertTenantAccess(actor, rtId);
    const tenant = await this.tenantsRepository.findTenantById(rtId);
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }
    return tenant;
  }

  async updateTenant(actor: AuthPrincipal, rtId: string, command: UpdateTenantCommand, meta: TenantRequestMeta): Promise<TenantRecord> {
    this.assertTenantAccess(actor, rtId);
    const tenant = await this.tenantsRepository.updateTenant(rtId, command, actor, meta);
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }
    return tenant;
  }

  async deleteTenant(actor: AuthPrincipal, rtId: string, meta: TenantRequestMeta): Promise<void> {
    this.assertSuperAdmin(actor);
    const deleted = await this.tenantsRepository.softDeleteTenant(rtId, actor, meta);
    if (!deleted) {
      throw new NotFoundException('Tenant was not found.');
    }
  }

  private assertTenantAccess(actor: AuthPrincipal, rtId: string): void {
    if (!this.isSuperAdmin(actor) && actor.rtId !== rtId) {
      throw new ForbiddenException('Tenant access is not allowed.');
    }
  }

  private assertSuperAdmin(actor: AuthPrincipal): void {
    if (!this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Super-admin access is required.');
    }
  }

  private isSuperAdmin(actor: AuthPrincipal): boolean {
    return actor.roles.includes('SUPER_ADMIN');
  }
}
