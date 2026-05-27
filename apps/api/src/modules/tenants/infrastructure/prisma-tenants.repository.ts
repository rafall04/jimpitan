/**
 * Purpose: Prisma persistence adapter for RT tenant foundation workflows.
 * Caller: TenantsModule dependency injection for TenantsService.
 * Deps: PrismaService, Prisma generated enums, tenant repository port.
 * MainFuncs: Creates, lists, reads, updates, soft-deletes RT tenant rows, and writes tenant audit logs.
 * SideEffects: Writes rts and audit_logs table rows.
 */
import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateTenantCommand, TenantRequestMeta, UpdateTenantCommand } from '../application/tenants.commands';
import type { TenantListScope, TenantRecord } from '../domain/tenant.types';
import type { TenantsRepositoryPort } from './tenants.repository.port';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createTenant(command: CreateTenantCommand, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<TenantRecord> {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.rt.create({
        data: {
          name: command.name,
          code: command.code,
          address: command.address,
          timezone: command.timezone ?? 'Asia/Jakarta',
          createdById: actor.userId,
          updatedById: actor.userId,
        },
        select: this.tenantSelect(),
      });
      await this.writeAudit(tx, {
        rtId: tenant.id,
        actor,
        meta,
        action: 'TENANT_CREATED',
        entityId: tenant.id,
        afterData: tenant,
      });

      return tenant;
    });
  }

  async findTenantById(rtId: string): Promise<TenantRecord | null> {
    return this.prisma.rt.findFirst({
      where: {
        id: rtId,
        deletedAt: null,
      },
      select: this.tenantSelect(),
    });
  }

  async listTenants(scope: TenantListScope & { page: number; limit: number }): Promise<PaginatedResult<TenantRecord>> {
    const where: Prisma.RtWhereInput = {
      deletedAt: null,
      ...(scope.includeAll ? {} : { id: scope.rtId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.rt.findMany({
        where,
        select: this.tenantSelect(),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (scope.page - 1) * scope.limit,
        take: scope.limit,
      }),
      this.prisma.rt.count({ where }),
    ]);

    return {
      items,
      page: scope.page,
      limit: scope.limit,
      total,
      totalPages: Math.ceil(total / scope.limit),
    };
  }

  async updateTenant(rtId: string, command: UpdateTenantCommand, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<TenantRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.rt.findFirst({
        where: {
          id: rtId,
          deletedAt: null,
        },
        select: this.tenantSelect(),
      });
      if (!before) {
        return null;
      }

      const after = await tx.rt.update({
        where: { id: rtId },
        data: {
          ...command,
          updatedById: actor.userId,
        },
        select: this.tenantSelect(),
      });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TENANT_UPDATED',
        entityId: rtId,
        beforeData: before,
        afterData: after,
      });

      return after;
    });
  }

  async softDeleteTenant(rtId: string, actor: AuthPrincipal, meta: TenantRequestMeta): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.rt.findFirst({
        where: {
          id: rtId,
          deletedAt: null,
        },
        select: this.tenantSelect(),
      });
      if (!before) {
        return false;
      }

      const after = await tx.rt.update({
        where: { id: rtId },
        data: {
          isActive: false,
          deletedById: actor.userId,
          deletedAt: new Date(),
        },
        select: this.tenantSelect(),
      });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'TENANT_DELETED',
        entityId: rtId,
        beforeData: before,
        afterData: after,
      });

      return true;
    });
  }

  private tenantSelect() {
    return {
      id: true,
      name: true,
      code: true,
      address: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.RtSelect;
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: TenantRequestMeta;
      action: string;
      entityId: string;
      beforeData?: unknown;
      afterData?: unknown;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: 'rt',
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        beforeData: input.beforeData === undefined ? undefined : this.toJson(input.beforeData),
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
