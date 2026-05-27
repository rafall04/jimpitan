/**
 * Purpose: Prisma persistence adapter for tenant-scoped append-only cash ledger reads.
 * Caller: LedgerModule dependency injection for LedgerService.
 * Deps: PrismaService, Prisma types, ledger repository port, and ledger domain types.
 * MainFuncs: Lists ledger entries, fetches ledger detail, and derives cash account balances from ledger rows.
 * SideEffects: Reads cash_ledgers and cash_accounts only.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { LedgerEntryListQuery } from '../application/ledger.commands';
import type { LedgerAccountBalance, LedgerEntryRecord } from '../domain/ledger.types';
import type { LedgerRepositoryPort } from './ledger.repository.port';

type LedgerDbRow = {
  id: string;
  rtId: string;
  cashAccountId: string;
  transactionId: string;
  ledgerSequence: number;
  entryType: 'INCREASE' | 'DECREASE';
  amount: Prisma.Decimal;
  balanceBefore: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  ledgerDate: Date;
  createdAt: Date;
};

@Injectable()
export class PrismaLedgerRepository implements LedgerRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listLedgerEntries(rtId: string, query: LedgerEntryListQuery): Promise<PaginatedResult<LedgerEntryRecord>> {
    const where = this.ledgerWhere(rtId, query);
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.cashLedger.findMany({
        where,
        select: this.ledgerSelect(),
        orderBy: [{ ledgerDate: query.sortDirection ?? 'desc' }, { ledgerSequence: query.sortDirection ?? 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.cashLedger.count({ where }),
    ]);

    return {
      items: entries.map((entry) => this.toLedgerEntryRecord(entry)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findLedgerEntryById(rtId: string, ledgerEntryId: string): Promise<LedgerEntryRecord | null> {
    const entry = await this.prisma.cashLedger.findFirst({
      where: { id: ledgerEntryId, rtId },
      select: this.ledgerSelect(),
    });

    return entry ? this.toLedgerEntryRecord(entry) : null;
  }

  async getCashAccountBalance(rtId: string, cashAccountId: string): Promise<LedgerAccountBalance | null> {
    const account = await this.prisma.cashAccount.findFirst({ where: { id: cashAccountId, rtId, deletedAt: null }, select: { id: true } });
    if (!account) {
      return null;
    }
    const latestLedger = await this.prisma.cashLedger.findFirst({
      where: { rtId, cashAccountId },
      orderBy: [{ ledgerSequence: 'desc' }, { id: 'desc' }],
      select: { ledgerSequence: true, balanceAfter: true },
    });

    return {
      cashAccountId,
      balance: (latestLedger?.balanceAfter ?? new Prisma.Decimal(0)).toString(),
      latestLedgerSequence: latestLedger?.ledgerSequence ?? 0,
      calculatedAt: new Date(),
    };
  }

  private ledgerWhere(rtId: string, query: LedgerEntryListQuery): Prisma.CashLedgerWhereInput {
    return {
      rtId,
      ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
      ...(query.transactionId ? { transactionId: query.transactionId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            ledgerDate: {
              ...(query.dateFrom ? { gte: this.toDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: this.toDate(query.dateTo) } : {}),
            },
          }
        : {}),
    };
  }

  private ledgerSelect() {
    return {
      id: true,
      rtId: true,
      cashAccountId: true,
      transactionId: true,
      ledgerSequence: true,
      entryType: true,
      amount: true,
      balanceBefore: true,
      balanceAfter: true,
      ledgerDate: true,
      createdAt: true,
    } satisfies Prisma.CashLedgerSelect;
  }

  private toLedgerEntryRecord(entry: LedgerDbRow): LedgerEntryRecord {
    return {
      id: entry.id,
      rtId: entry.rtId,
      cashAccountId: entry.cashAccountId,
      transactionId: entry.transactionId,
      ledgerSequence: entry.ledgerSequence,
      entryType: entry.entryType,
      amount: entry.amount.toString(),
      balanceBefore: entry.balanceBefore.toString(),
      balanceAfter: entry.balanceAfter.toString(),
      ledgerDate: entry.ledgerDate,
      createdAt: entry.createdAt,
    };
  }

  private toDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }
}
