/**
 * Purpose: Prisma persistence adapter for Auth foundation workflows.
 * Caller: AuthModule dependency injection for AuthService.
 * Deps: PrismaService, Prisma generated enums, Auth repository port.
 * MainFuncs: Resolves login identity, sessions, tenant principal, rotation, logout, and auth audit logs.
 * SideEffects: Reads and writes users, sessions, memberships, and audit_logs tables.
 */
import { Injectable } from '@nestjs/common';
import { AuditActorType, MembershipStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthLoginIdentity, AuthMembershipGrant, AuthPrincipal } from '../domain/auth.types';
import type {
  AuthAuditInput,
  AuthRepositoryPort,
  CreateRefreshSessionInput,
  RotateRefreshSessionInput,
} from './auth.repository.port';

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
export class PrismaAuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findLoginIdentity(identifier: string): Promise<AuthLoginIdentity | null> {
    const normalizedIdentifier = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        OR: [
          { email: { equals: normalizedIdentifier, mode: Prisma.QueryMode.insensitive } },
          { phone: normalizedIdentifier },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        passwordHash: true,
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          select: this.membershipGrantSelect(),
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        status: user.status,
        passwordHash: user.passwordHash,
      },
      memberships: user.memberships.map((membership) => this.toMembershipGrant(membership)),
    };
  }

  async createRefreshSession(input: CreateRefreshSessionInput): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.session.create({
        data: {
          id: input.id,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          expiresAt: input.expiresAt,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
      }),
      this.prisma.user.update({
        where: { id: input.userId },
        data: { lastLoginAt: now },
      }),
    ]);
  }

  async findRefreshSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        refreshTokenHash: true,
        expiresAt: true,
        revokedAt: true,
      },
    });
  }

  async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: input.sessionId,
        refreshTokenHash: input.currentRefreshTokenHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
    });

    return result.count === 1;
  }

  async revokeRefreshSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async resolvePrincipal(userId: string, rtId?: string): Promise<AuthPrincipal | null> {
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
      select: this.membershipGrantSelect(),
    });

    if (!membership) {
      return null;
    }

    const grant = this.toMembershipGrant(membership);
    return {
      userId,
      membershipId: grant.id,
      rtId: grant.rtId,
      roles: grant.roles,
      permissions: grant.permissions,
    };
  }

  async writeAuthAudit(input: AuthAuditInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.userId,
        actorType: input.userId ? AuditActorType.USER : AuditActorType.SYSTEM,
        action: input.action,
        entityType: 'auth_session',
        requestId: input.correlationId,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  private membershipGrantSelect() {
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

  private toMembershipGrant(membership: MembershipWithRoles): AuthMembershipGrant {
    const roles = new Set<string>();
    const permissions = new Set<string>();

    for (const assignment of membership.roles) {
      roles.add(assignment.role.key);
      for (const rolePermission of assignment.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
    }

    return {
      id: membership.id,
      rtId: membership.rtId,
      roles: [...roles],
      permissions: [...permissions],
    };
  }
}
