/**
 * Purpose: Prisma persistence adapter for tenant-scoped RBAC context reads.
 * Caller: RbacModule dependency injection and future RBAC workflows.
 * Deps: PrismaService, Prisma generated enums, RBAC repository port.
 * MainFuncs: Loads active membership roles and permissions for a user in an RT.
 * SideEffects: Reads users, memberships, roles, and permissions tables.
 */
import { Injectable } from '@nestjs/common';
import { MembershipStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PermissionCheckContext } from '../domain/rbac.types';
import type { RbacRepositoryPort } from './rbac.repository.port';

type MembershipWithRoles = {
  id: string;
  rtId: string;
  roles: Array<{
    role: {
      key: string;
      permissions: Array<{
        permission: {
          key: string;
        };
      }>;
    };
  }>;
};

@Injectable()
export class PrismaRbacRepository implements RbacRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionContext(userId: string, rtId?: string): Promise<PermissionCheckContext | null> {
    const membership = await this.prisma.rtMembership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        ...(rtId ? { rtId } : {}),
        user: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: this.membershipSelect(),
    });

    if (!membership) {
      return null;
    }

    const roles = new Set<string>();
    const permissions = new Set<string>();
    for (const assignment of (membership as MembershipWithRoles).roles) {
      roles.add(assignment.role.key);
      for (const rolePermission of assignment.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return {
      userId,
      rtId: membership.rtId,
      membershipId: membership.id,
      roles: [...roles],
      permissions: [...permissions],
    } as PermissionCheckContext;
  }

  private membershipSelect() {
    return {
      id: true,
      rtId: true,
      roles: {
        where: {
          role: {
            deletedAt: null,
          },
        },
        select: {
          role: {
            select: {
              key: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      key: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.RtMembershipSelect;
  }
}
