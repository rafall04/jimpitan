/**
 * Purpose: Prisma adapter for per-RT settings (finance/kas public visibility).
 * Caller: SettingsModule wiring; SettingsService via the SETTINGS_REPOSITORY token.
 * Deps: PrismaService, Prisma JSON + audit, finance visibility domain types.
 * MainFuncs: Reads/writes the `public.finance.visibility` setting (token stored as '' when none) + audits writes.
 * SideEffects: Upserts a settings row and writes an audit row in one transaction.
 */
import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DEFAULT_FINANCE_VISIBILITY, FINANCE_VISIBILITY_KEY, type FinanceVisibility } from '../domain/settings.types';
import type { SettingsRepositoryPort } from './settings.repository.port';

@Injectable()
export class PrismaSettingsRepository implements SettingsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceVisibility(rtId: string): Promise<FinanceVisibility> {
    const row = await this.prisma.setting.findUnique({ where: { rtId_key: { rtId, key: FINANCE_VISIBILITY_KEY } }, select: { value: true } });
    return this.parse(row?.value);
  }

  async getFinanceVisibilityByRtCode(rtCode: string): Promise<FinanceVisibility | null> {
    const rt = await this.prisma.rt.findFirst({
      where: { code: { equals: rtCode.trim(), mode: 'insensitive' }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    return rt ? this.getFinanceVisibility(rt.id) : null;
  }

  async setFinanceVisibility(rtId: string, value: FinanceVisibility, actorUserId: string): Promise<FinanceVisibility> {
    const json: Prisma.InputJsonValue = { mode: value.mode, token: value.token ?? '' };
    await this.prisma.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { rtId_key: { rtId, key: FINANCE_VISIBILITY_KEY } },
        update: { value: json, updatedById: actorUserId },
        create: { rtId, key: FINANCE_VISIBILITY_KEY, value: json, updatedById: actorUserId },
      });
      await tx.auditLog.create({
        data: {
          rtId,
          actorUserId,
          actorType: AuditActorType.USER,
          action: 'FINANCE_VISIBILITY_UPDATED',
          entityType: 'setting',
          afterData: { mode: value.mode, tokenSet: value.token !== null } as Prisma.InputJsonValue,
        },
      });
    });
    return value;
  }

  private parse(value: unknown): FinanceVisibility {
    if (value && typeof value === 'object' && 'mode' in value) {
      const raw = value as { mode?: unknown; token?: unknown };
      const mode = raw.mode === 'TOKEN' ? 'TOKEN' : 'PUBLIC';
      const token = typeof raw.token === 'string' && raw.token.length > 0 ? raw.token : null;
      return { mode, token };
    }
    return DEFAULT_FINANCE_VISIBILITY;
  }
}
