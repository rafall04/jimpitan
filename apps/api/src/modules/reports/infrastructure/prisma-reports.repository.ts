/**
 * Purpose: Prisma persistence adapter for tenant-scoped ledger-derived reports, public transparency reads, and export requests.
 * Caller: ReportsModule dependency injection for ReportsService.
 * Deps: PrismaService, Prisma enums/types, AuthPrincipal, report commands, report domain types, and repository port.
 * MainFuncs: Aggregates immutable cash ledgers, mode-aware collection totals, approvals, audit logs, public announcements, and report export rows.
 * SideEffects: Reads report source tables and writes report_exports plus audit_logs for export mutations.
 */
import { ConflictException, Injectable } from '@nestjs/common';
import {
  AnnouncementStatus,
  AnnouncementVisibility,
  ApprovalStatus,
  AuditActorType,
  CollectionItemStatus,
  CollectionMode,
  CollectionStatus,
  HouseStatus,
  LedgerEntryType,
  Prisma,
  ReportExportFormat,
  ReportExportStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  ApprovalActivityReportQuery,
  AuditActivityReportQuery,
  CollectionReportQuery,
  CreateReportExportCommand,
  ExpenseCategoryReportQuery,
  FinanceReportQuery,
  OutstandingReportQuery,
  PublicFeedQuery,
  PublicMonthlyFinanceQuery,
  ReportExportListQuery,
  ReportRequestMeta,
} from '../application/reports.commands';
import type {
  ApprovalActivityReport,
  AreaProgressReportItem,
  AuditActivityReport,
  CashBalanceSummary,
  CashFlowSummaryReport,
  CategoryBreakdownItem,
  CollectionPerformanceReport,
  ExpenseCategoryBreakdownReport,
  FinanceSummaryReport,
  OutstandingHouseReportItem,
  PublicAnnouncement,
  PublicMonthlyFinanceReport,
  PublicReportMetadata,
  PublicTransparencySummary,
  LedgerExportRow,
  ReportExportFileMetadata,
  ReportExportRecord,
  ReportSnapshotMeta,
  TransactionExportRow,
} from '../domain/reports.types';
import type { ReportsRepositoryPort } from './reports.repository.port';

type AuditClient = Pick<Prisma.TransactionClient, 'auditLog'> | Pick<PrismaService, 'auditLog'>;

type LedgerReportRow = {
  id: string;
  cashAccountId: string;
  transactionId: string;
  ledgerSequence: number;
  entryType: LedgerEntryType;
  amount: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  ledgerDate: Date;
  transaction: {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    categoryId: string;
    category: {
      id: string;
      key: string;
      name: string;
      type: TransactionType;
    };
  };
  cashAccount: {
    id: string;
    key: string;
    name: string;
    currency: string;
  };
};

type CashAccountBalanceRow = {
  id: string;
  key: string;
  name: string;
  currency: string;
  ledgers: Array<{
    ledgerSequence: number;
    balanceAfter: Prisma.Decimal;
  }>;
};

type ReportExportRow = {
  id: string;
  rtId: string;
  requestedById: string;
  reportType: string;
  format: string;
  status: ReportExportStatus;
  filters: Prisma.JsonValue;
  fileName: string | null;
  objectKey: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaReportsRepository implements ReportsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceSummary(rtId: string, query: FinanceReportQuery): Promise<FinanceSummaryReport> {
    const [entries, cashBalances] = await Promise.all([
      this.prisma.cashLedger.findMany({
        where: this.ledgerWhere(rtId, query),
        select: this.ledgerReportSelect(),
        orderBy: [{ ledgerDate: 'asc' }, { ledgerSequence: 'asc' }],
      }),
      this.getCashBalances(rtId, query.cashAccountId, this.endDate(query.dateTo)),
    ]);
    const ledgerRows = entries as LedgerReportRow[];
    const totals = this.calculateFinanceTotals(ledgerRows);

    return {
      reportType: this.reportTypeForPeriod(query.period ?? 'CUSTOM'),
      period: query.period ?? 'CUSTOM',
      range: this.range(query),
      totals,
      cashBalances,
      categoryBreakdown: this.categoryBreakdown(ledgerRows),
      source: { type: 'LEDGER', postedOnly: true },
      snapshot: this.snapshot('LEDGER', 'LIVE_LEDGER_QUERY'),
      generatedAt: new Date(),
    };
  }

  async getCollectionPerformance(rtId: string, query: CollectionReportQuery): Promise<CollectionPerformanceReport> {
    const collections = await this.prisma.jimpitanCollection.findMany({
      where: {
        rtId,
        collectionDate: this.dateFieldRange(query),
        status: query.collectionStatus ?? { in: [CollectionStatus.SUBMITTED, CollectionStatus.VALIDATED] },
        ...(query.collectionMode ? { collectionMode: query.collectionMode } : {}),
        ...(query.areaId ? { schedule: { areaId: query.areaId } } : {}),
      },
      select: {
        id: true,
        collectionMode: true,
        status: true,
        totalAmount: true,
        items: { select: { amount: true, status: true } },
      },
    });
    const reportableCollections = collections.filter((collection) => this.isCollectionIncludedInPerformance(collection.status, query.collectionStatus));
    const itemCollections = reportableCollections.filter((collection) => collection.collectionMode !== CollectionMode.BULK_TOTAL);
    const totalItems = itemCollections.reduce((sum, collection) => sum + collection.items.length, 0);
    const paidItems = itemCollections.reduce((sum, collection) => sum + collection.items.filter((item) => this.isPaidCollectionStatus(item.status)).length, 0);
    const totalCollected = reportableCollections.reduce((sum, collection) => sum.plus(this.collectionPerformanceAmount(collection)), this.zero());

    return {
      range: this.range(query),
      totalCollections: reportableCollections.length,
      perHouseCollections: reportableCollections.filter((collection) => collection.collectionMode === CollectionMode.PER_HOUSE).length,
      bulkTotalCollections: reportableCollections.filter((collection) => collection.collectionMode === CollectionMode.BULK_TOTAL).length,
      hybridCollections: reportableCollections.filter((collection) => collection.collectionMode === CollectionMode.HYBRID).length,
      validatedCollections: reportableCollections.filter((collection) => collection.status === CollectionStatus.VALIDATED).length,
      submittedCollections: reportableCollections.filter((collection) => collection.status === CollectionStatus.SUBMITTED).length,
      totalCollected: totalCollected.toString(),
      totalItems,
      paidItems,
      unpaidItems: totalItems - paidItems,
      completionRate: totalItems === 0 ? 0 : Math.round((paidItems / totalItems) * 10000) / 100,
      snapshot: this.snapshot('COLLECTION', 'LIVE_DOMAIN_QUERY'),
      generatedAt: new Date(),
    };
  }

  async getOutstandingHouses(rtId: string, query: OutstandingReportQuery): Promise<PaginatedResult<OutstandingHouseReportItem>> {
    const where = this.outstandingWhere(rtId, query);
    const [items, total] = await Promise.all([
      this.prisma.collectionItem.findMany({
        where,
        select: this.outstandingSelect(),
        orderBy: [{ collection: { collectionDate: query.sortDirection ?? 'desc' } }, { house: { houseNumber: 'asc' } }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.collectionItem.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toOutstandingItem(item)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getPerAreaProgress(rtId: string, query: CollectionReportQuery): Promise<AreaProgressReportItem[]> {
    const collectionStatus = query.collectionStatus ?? { in: [CollectionStatus.SUBMITTED, CollectionStatus.VALIDATED] };
    const includeBulkTotals = !query.collectionMode || query.collectionMode === CollectionMode.BULK_TOTAL;
    const [areas, bulkCollections] = await Promise.all([
      this.prisma.area.findMany({
        where: {
          rtId,
          deletedAt: null,
          isActive: true,
          ...(query.areaId ? { id: query.areaId } : {}),
        },
        select: {
          id: true,
          code: true,
          name: true,
          houses: {
            where: { rtId, deletedAt: null, status: { not: HouseStatus.INACTIVE } },
            select: {
              id: true,
              collectionItems: {
                where: {
                  collection: {
                    rtId,
                    collectionDate: this.dateFieldRange(query),
                    status: collectionStatus,
                    collectionMode: query.collectionMode ?? { not: CollectionMode.BULK_TOTAL },
                  },
                },
                select: { amount: true, status: true },
              },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      includeBulkTotals
        ? this.prisma.jimpitanCollection.findMany({
            where: {
              rtId,
              collectionMode: CollectionMode.BULK_TOTAL,
              collectionDate: this.dateFieldRange(query),
              status: collectionStatus,
              schedule: { areaId: query.areaId ? query.areaId : { not: null } },
            },
            select: { totalAmount: true, schedule: { select: { areaId: true } } },
          })
        : Promise.resolve([]),
    ]);
    const bulkTotalByArea = new Map<string, Prisma.Decimal>();
    for (const collection of bulkCollections) {
      const areaId = collection.schedule?.areaId;
      if (!areaId) {
        continue;
      }
      bulkTotalByArea.set(areaId, (bulkTotalByArea.get(areaId) ?? this.zero()).plus(collection.totalAmount));
    }

    return areas.map((area) => {
      let completedHouses = 0;
      let paidHouses = 0;
      let totalCollected = this.zero();
      for (const house of area.houses) {
        if (house.collectionItems.length > 0) {
          completedHouses += 1;
        }
        if (house.collectionItems.some((item) => this.isPaidCollectionStatus(item.status))) {
          paidHouses += 1;
        }
        totalCollected = totalCollected.plus(house.collectionItems.reduce((sum, item) => (item.status === CollectionItemStatus.PAID ? sum.plus(item.amount) : sum), this.zero()));
      }
      totalCollected = totalCollected.plus(bulkTotalByArea.get(area.id) ?? this.zero());
      const totalHouses = query.collectionMode === CollectionMode.BULK_TOTAL ? 0 : area.houses.length;
      return {
        areaId: area.id,
        areaCode: area.code,
        areaName: area.name,
        collectionMode: bulkTotalByArea.has(area.id) && area.houses.every((house) => house.collectionItems.length === 0) ? CollectionMode.BULK_TOTAL : undefined,
        totalHouses,
        completedHouses,
        paidHouses,
        outstandingHouses: Math.max(totalHouses - paidHouses, 0),
        totalCollected: totalCollected.toString(),
      };
    });
  }

  async getExpenseCategoryBreakdown(rtId: string, query: ExpenseCategoryReportQuery): Promise<ExpenseCategoryBreakdownReport> {
    const entries = (await this.prisma.cashLedger.findMany({
      where: {
        ...this.ledgerWhere(rtId, query),
        transaction: {
          rtId,
          status: TransactionStatus.POSTED,
          deletedAt: null,
          type: TransactionType.EXPENSE,
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        },
      },
      select: this.ledgerReportSelect(),
      orderBy: [{ ledgerDate: 'asc' }, { ledgerSequence: 'asc' }],
    })) as LedgerReportRow[];

    return {
      range: this.range(query),
      categories: this.categoryBreakdown(entries).filter((item) => item.expense !== '0'),
      snapshot: this.snapshot('LEDGER', 'LIVE_LEDGER_QUERY'),
      generatedAt: new Date(),
    };
  }

  async getCashFlowSummary(rtId: string, query: FinanceReportQuery): Promise<CashFlowSummaryReport> {
    const [summary, openingBalance, closingBalance] = await Promise.all([
      this.getFinanceSummary(rtId, query),
      this.getBalanceAt(rtId, query.cashAccountId, this.startDate(query.dateFrom), false),
      this.getBalanceAt(rtId, query.cashAccountId, this.endDate(query.dateTo), true),
    ]);

    return {
      range: this.range(query),
      openingBalance: openingBalance.toString(),
      income: summary.totals.income,
      expense: summary.totals.expense,
      netCashFlow: summary.totals.netCashFlow,
      closingBalance: closingBalance.toString(),
      snapshot: this.snapshot('LEDGER', 'LIVE_LEDGER_QUERY'),
      generatedAt: new Date(),
    };
  }

  async getApprovalActivity(rtId: string, query: ApprovalActivityReportQuery): Promise<ApprovalActivityReport> {
    const where = {
      rtId,
      createdAt: this.dateFieldRange(query),
      ...(query.status ? { status: query.status } : {}),
    } satisfies Prisma.ExpenseApprovalWhereInput;
    const grouped = await this.prisma.expenseApproval.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts = new Map<ApprovalStatus, number>();
    for (const row of grouped) {
      counts.set(row.status, row._count._all);
    }

    return {
      range: this.range(query),
      pending: counts.get(ApprovalStatus.PENDING) ?? 0,
      approved: counts.get(ApprovalStatus.APPROVED) ?? 0,
      rejected: counts.get(ApprovalStatus.REJECTED) ?? 0,
      cancelled: counts.get(ApprovalStatus.CANCELLED) ?? 0,
      byStatus: Array.from(counts.entries()).map(([status, count]) => ({ status, count })),
      snapshot: this.snapshot('APPROVAL', 'LIVE_DOMAIN_QUERY'),
      generatedAt: new Date(),
    };
  }

  async getAuditActivity(rtId: string, query: AuditActivityReportQuery): Promise<AuditActivityReport> {
    const where = {
      rtId,
      createdAt: this.dateFieldRange(query),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    } satisfies Prisma.AuditLogWhereInput;
    const [totalEvents, byActionRows, byEntityRows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.groupBy({ by: ['action'], where, _count: { _all: true }, orderBy: { action: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['entityType'], where, _count: { _all: true }, orderBy: { entityType: 'asc' } }),
    ]);

    return {
      range: this.range(query),
      totalEvents,
      byAction: byActionRows.map((row) => ({ action: row.action, count: row._count._all })),
      byEntityType: byEntityRows.map((row) => ({ entityType: row.entityType, count: row._count._all })),
      snapshot: this.snapshot('AUDIT', 'LIVE_DOMAIN_QUERY'),
      generatedAt: new Date(),
    };
  }

  async createExportRequest(rtId: string, command: CreateReportExportCommand, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord> {
    if (command.idempotencyKey) {
      const existing = await this.prisma.reportExport.findFirst({ where: { rtId, idempotencyKey: command.idempotencyKey }, select: this.reportExportSelect() });
      if (existing) {
        this.assertExportReplayMatches(existing as ReportExportRow, command);
        const record = this.toReportExportRecord(existing as ReportExportRow);
        await this.writeAudit(this.prisma, {
          rtId,
          actor,
          meta,
          action: 'REPORT_EXPORT_IDEMPOTENCY_REPLAYED',
          entityType: 'report_export',
          entityId: record.id,
          afterData: record,
        });
        return record;
      }
    }

    const created = await this.prisma.reportExport.create({
      data: {
        rtId,
        requestedById: actor.userId,
        reportType: command.reportType,
        format: command.format,
        status: ReportExportStatus.QUEUED,
        filters: this.toJson(command.filters ?? {}),
        idempotencyKey: command.idempotencyKey,
      },
      select: this.reportExportSelect(),
    });
    const record = this.toReportExportRecord(created as ReportExportRow);
    await this.writeAudit(this.prisma, {
      rtId,
      actor,
      meta,
      action: 'REPORT_EXPORT_REQUESTED',
      entityType: 'report_export',
      entityId: record.id,
      afterData: record,
    });
    return record;
  }

  async listExportRequests(rtId: string, query: ReportExportListQuery): Promise<PaginatedResult<ReportExportRecord>> {
    const where: Prisma.ReportExportWhereInput = {
      rtId,
      ...(query.reportType ? { reportType: query.reportType } : {}),
      ...(query.status ? { status: this.toPrismaExportStatus(query.status) } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.reportExport.findMany({
        where,
        select: this.reportExportSelect(),
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.reportExport.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toReportExportRecord(row as ReportExportRow)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findExportRequestById(rtId: string, exportId: string): Promise<ReportExportRecord | null> {
    const row = await this.prisma.reportExport.findFirst({ where: { rtId, id: exportId }, select: this.reportExportSelect() });
    return row ? this.toReportExportRecord(row as ReportExportRow) : null;
  }

  async recoverStaleCsvExports(staleBefore: Date): Promise<number> {
    const updated = await this.prisma.reportExport.updateMany({
      where: {
        status: ReportExportStatus.PROCESSING,
        format: ReportExportFormat.CSV,
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: ReportExportStatus.QUEUED,
        errorMessage: null,
      },
    });
    return updated.count;
  }

  async claimPendingCsvExports(limit: number): Promise<ReportExportRecord[]> {
    const rows = await this.prisma.reportExport.findMany({
      where: { status: ReportExportStatus.QUEUED, format: ReportExportFormat.CSV },
      select: this.reportExportSelect(),
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    const claimed: ReportExportRecord[] = [];

    for (const row of rows) {
      const updated = await this.prisma.reportExport.updateMany({
        where: { id: row.id, rtId: row.rtId, status: ReportExportStatus.QUEUED },
        data: { status: ReportExportStatus.PROCESSING, errorMessage: null },
      });
      if (updated.count > 0) {
        const record = await this.findExportRequestById(row.rtId, row.id);
        if (record) {
          claimed.push(record);
        }
      }
    }

    return claimed;
  }

  async markExportProcessing(rtId: string, exportId: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null> {
    const record = await this.updateExportStatus(rtId, exportId, { status: ReportExportStatus.PROCESSING, errorMessage: null });
    if (record) {
      await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'REPORT_EXPORT_PROCESSING', entityType: 'report_export', entityId: record.id, afterData: record });
    }
    return record;
  }

  async completeExportRequest(rtId: string, exportId: string, metadata: ReportExportFileMetadata, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null> {
    const record = await this.updateExportStatus(rtId, exportId, {
      status: ReportExportStatus.COMPLETED,
      fileName: metadata.fileName,
      objectKey: metadata.objectKey,
      expiresAt: metadata.expiresAt,
      completedAt: metadata.completedAt,
      errorMessage: null,
    });
    if (record) {
      await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'REPORT_EXPORT_COMPLETED', entityType: 'report_export', entityId: record.id, afterData: record });
    }
    return record;
  }

  async failExportRequest(rtId: string, exportId: string, errorMessage: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null> {
    const record = await this.updateExportStatus(rtId, exportId, {
      status: ReportExportStatus.FAILED,
      errorMessage,
      fileName: null,
      objectKey: null,
      completedAt: null,
    });
    if (record) {
      await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'REPORT_EXPORT_FAILED', entityType: 'report_export', entityId: record.id, afterData: record });
    }
    return record;
  }

  async retryExportRequest(rtId: string, exportId: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null> {
    const updated = await this.prisma.reportExport.updateMany({
      where: { rtId, id: exportId, status: ReportExportStatus.FAILED },
      data: { status: ReportExportStatus.QUEUED, errorMessage: null, fileName: null, objectKey: null, completedAt: null, expiresAt: null },
    });
    if (updated.count === 0) {
      return null;
    }
    const record = await this.findExportRequestById(rtId, exportId);
    if (record) {
      await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'REPORT_EXPORT_RETRIED', entityType: 'report_export', entityId: record.id, afterData: record });
    }
    return record;
  }

  async auditExportDownload(rtId: string, record: ReportExportRecord, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<void> {
    await this.writeAudit(this.prisma, { rtId, actor, meta, action: 'REPORT_EXPORT_DOWNLOADED', entityType: 'report_export', entityId: record.id, afterData: { exportId: record.id, fileName: record.fileName, reportType: record.reportType } });
  }

  async expireExports(rtId: string, now: Date): Promise<number> {
    const result = await this.prisma.reportExport.updateMany({
      where: { rtId, status: ReportExportStatus.COMPLETED, expiresAt: { lte: now } },
      data: { status: ReportExportStatus.EXPIRED },
    });
    return result.count;
  }

  async getLedgerExportRows(rtId: string, query: FinanceReportQuery): Promise<LedgerExportRow[]> {
    const rows = await this.prisma.cashLedger.findMany({
      where: this.ledgerWhere(rtId, query),
      select: {
        ledgerDate: true,
        ledgerSequence: true,
        entryType: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        cashAccount: { select: { name: true } },
        transactionId: true,
      },
      orderBy: [{ ledgerDate: 'asc' }, { ledgerSequence: 'asc' }],
      take: 10_000,
    });
    return rows.map((row) => ({
      ledgerDate: row.ledgerDate,
      ledgerSequence: row.ledgerSequence,
      entryType: row.entryType,
      amount: row.amount.toString(),
      balanceBefore: row.balanceBefore.toString(),
      balanceAfter: row.balanceAfter.toString(),
      cashAccountName: row.cashAccount.name,
      transactionId: row.transactionId,
    }));
  }

  async getTransactionExportRows(rtId: string, query: FinanceReportQuery): Promise<TransactionExportRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        rtId,
        deletedAt: null,
        transactionDate: this.dateFieldRange(query),
        ...(query.cashAccountId ? { cashAccountId: query.cashAccountId } : {}),
      },
      select: {
        transactionDate: true,
        type: true,
        status: true,
        amount: true,
        description: true,
        referenceNumber: true,
        category: { select: { name: true } },
        cashAccount: { select: { name: true } },
      },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      take: 10_000,
    });
    return rows.map((row) => ({
      transactionDate: row.transactionDate,
      type: row.type,
      status: row.status,
      amount: row.amount.toString(),
      categoryName: row.category.name,
      cashAccountName: row.cashAccount.name,
      description: row.description,
      referenceNumber: row.referenceNumber,
    }));
  }

  async getPublicSummaryByRtCode(rtCode: string): Promise<PublicTransparencySummary | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const month = this.currentMonth();
    const summary = await this.getFinanceSummary(rt.id, { period: 'MONTHLY', dateFrom: `${month}-01`, dateTo: this.endOfMonth(month) });
    const totalBalance = summary.cashBalances.reduce((sum, account) => sum.plus(account.balance), this.zero());

    return {
      rt: { code: rt.code, name: rt.name },
      cashBalance: {
        totalBalance: totalBalance.toString(),
        currency: summary.cashBalances[0]?.currency ?? 'IDR',
        accountCount: summary.cashBalances.length,
      },
      totals: {
        income: summary.totals.income,
        expense: summary.totals.expense,
        netCashFlow: summary.totals.netCashFlow,
      },
      currentMonth: month,
      lastUpdatedAt: summary.generatedAt,
    };
  }

  async getPublicMonthlyFinanceByRtCode(rtCode: string, query: PublicMonthlyFinanceQuery): Promise<PublicMonthlyFinanceReport | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const summary = await this.getFinanceSummary(rt.id, { period: 'MONTHLY', dateFrom: `${query.month}-01`, dateTo: this.endOfMonth(query.month) });

    return {
      month: query.month,
      totals: {
        income: summary.totals.income,
        expense: summary.totals.expense,
        netCashFlow: summary.totals.netCashFlow,
      },
      categorySummaries: summary.categoryBreakdown.map((item) => {
        const isIncrease = item.income !== '0';
        return {
          categoryKey: item.categoryKey,
          categoryName: item.categoryName,
          type: item.type,
          total: isIncrease ? item.income : item.expense,
          direction: isIncrease ? LedgerEntryType.INCREASE : LedgerEntryType.DECREASE,
        };
      }),
      generatedAt: summary.generatedAt,
    };
  }

  async listPublicReportMetadataByRtCode(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicReportMetadata> | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const where = this.publicAnnouncementWhere(rt.id, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        select: { id: true, title: true, publishedAt: true },
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, title: row.title, publishedAt: row.publishedAt ?? new Date(0), type: 'ANNOUNCEMENT' })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async listPublicAnnouncementsByRtCode(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicAnnouncement> | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const where = this.publicAnnouncementWhere(rt.id, query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        select: { id: true, title: true, body: true, publishedAt: true, slug: true, type: true },
        orderBy: { publishedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({ id: row.id, title: row.title, body: row.body, publishedAt: row.publishedAt ?? new Date(0), slug: row.slug, type: row.type })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private ledgerWhere(rtId: string, query: FinanceReportQuery | ExpenseCategoryReportQuery): Prisma.CashLedgerWhereInput {
    const cashAccountId = 'cashAccountId' in query ? query.cashAccountId : undefined;
    return {
      rtId,
      ...(cashAccountId ? { cashAccountId } : {}),
      ledgerDate: this.dateFieldRange(query),
      transaction: { rtId, status: TransactionStatus.POSTED, deletedAt: null },
    };
  }

  private async getCashBalances(rtId: string, cashAccountId?: string, asOf?: Date): Promise<CashBalanceSummary[]> {
    const accounts = (await this.prisma.cashAccount.findMany({
      where: { rtId, deletedAt: null, ...(cashAccountId ? { id: cashAccountId } : {}) },
      select: {
        id: true,
        key: true,
        name: true,
        currency: true,
        ledgers: {
          where: { rtId, ...(asOf ? { ledgerDate: { lte: asOf } } : {}) },
          select: { ledgerSequence: true, balanceAfter: true },
          orderBy: [{ ledgerDate: 'desc' }, { ledgerSequence: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ key: 'asc' }],
    })) as CashAccountBalanceRow[];

    return accounts.map((account) => ({
      cashAccountId: account.id,
      key: account.key,
      name: account.name,
      currency: account.currency,
      balance: (account.ledgers[0]?.balanceAfter ?? this.zero()).toString(),
      ledgerSequence: account.ledgers[0]?.ledgerSequence ?? 0,
    }));
  }

  private async getBalanceAt(rtId: string, cashAccountId: string | undefined, at: Date, inclusive: boolean): Promise<Prisma.Decimal> {
    const accounts = (await this.prisma.cashAccount.findMany({
      where: { rtId, deletedAt: null, ...(cashAccountId ? { id: cashAccountId } : {}) },
      select: {
        id: true,
        ledgers: {
          where: { rtId, ledgerDate: inclusive ? { lte: at } : { lt: at } },
          select: { ledgerSequence: true, balanceAfter: true },
          orderBy: [{ ledgerDate: 'desc' }, { ledgerSequence: 'desc' }],
          take: 1,
        },
      },
    })) as Array<{ ledgers: Array<{ balanceAfter: Prisma.Decimal }> }>;
    return accounts.reduce((sum, account) => sum.plus(account.ledgers[0]?.balanceAfter ?? this.zero()), this.zero());
  }

  private calculateFinanceTotals(entries: LedgerReportRow[]) {
    const income = entries.reduce((sum, entry) => (entry.entryType === LedgerEntryType.INCREASE ? sum.plus(entry.amount) : sum), this.zero());
    const expense = entries.reduce((sum, entry) => (entry.entryType === LedgerEntryType.DECREASE ? sum.plus(entry.amount) : sum), this.zero());
    return {
      income: income.toString(),
      expense: expense.toString(),
      netCashFlow: income.minus(expense).toString(),
      ledgerEntryCount: entries.length,
      transactionCount: new Set(entries.map((entry) => entry.transactionId)).size,
    };
  }

  private categoryBreakdown(entries: LedgerReportRow[]): CategoryBreakdownItem[] {
    const map = new Map<
      string,
      {
        categoryId: string;
        categoryKey: string;
        categoryName: string;
        type: TransactionType;
        income: Prisma.Decimal;
        expense: Prisma.Decimal;
        transactionIds: Set<string>;
      }
    >();
    for (const entry of entries) {
      const current = map.get(entry.transaction.category.id) ?? {
        categoryId: entry.transaction.category.id,
        categoryKey: entry.transaction.category.key,
        categoryName: entry.transaction.category.name,
        type: entry.transaction.category.type,
        income: this.zero(),
        expense: this.zero(),
        transactionIds: new Set<string>(),
      };
      if (entry.entryType === LedgerEntryType.INCREASE) {
        current.income = current.income.plus(entry.amount);
      } else {
        current.expense = current.expense.plus(entry.amount);
      }
      current.transactionIds.add(entry.transactionId);
      map.set(current.categoryId, current);
    }

    return Array.from(map.values()).map((item) => ({
      categoryId: item.categoryId,
      categoryKey: item.categoryKey,
      categoryName: item.categoryName,
      type: item.type,
      income: item.income.toString(),
      expense: item.expense.toString(),
      net: item.income.minus(item.expense).toString(),
      transactionCount: item.transactionIds.size,
    }));
  }

  private collectionPerformanceAmount(collection: { collectionMode: CollectionMode; totalAmount: Prisma.Decimal; items: Array<{ amount: Prisma.Decimal; status: CollectionItemStatus }> }): Prisma.Decimal {
    if (collection.collectionMode === CollectionMode.BULK_TOTAL) {
      return collection.totalAmount;
    }
    return collection.items.reduce((itemSum, item) => (item.status === CollectionItemStatus.PAID ? itemSum.plus(item.amount) : itemSum), this.zero());
  }

  private outstandingWhere(rtId: string, query: OutstandingReportQuery): Prisma.CollectionItemWhereInput {
    return {
      rtId,
      status: query.status ?? { in: this.outstandingStatuses() },
      collectionId: query.collectionId,
      collection: {
        rtId,
        collectionDate: this.dateFieldRange(query),
        status: { in: [CollectionStatus.SUBMITTED, CollectionStatus.VALIDATED] },
        collectionMode: { not: CollectionMode.BULK_TOTAL },
      },
      house: {
        rtId,
        deletedAt: null,
        status: { not: HouseStatus.INACTIVE },
        area: { rtId, deletedAt: null, isActive: true },
        ...(query.areaId ? { areaId: query.areaId } : {}),
        ...(query.search ? { houseNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } } : {}),
      },
    };
  }

  private outstandingSelect() {
    return {
      id: true,
      houseId: true,
      amount: true,
      status: true,
      collection: { select: { id: true, collectionDate: true, collectionMode: true, status: true } },
      house: { select: { id: true, houseNumber: true, area: { select: { id: true, code: true, name: true } } } },
    } satisfies Prisma.CollectionItemSelect;
  }

  private toOutstandingItem(item: {
    houseId: string;
    amount: Prisma.Decimal;
    status: CollectionItemStatus;
    collection: { id: string; collectionDate: Date; collectionMode: CollectionMode };
    house: { id: string; houseNumber: string; area: { id: string; code: string; name: string } };
  }): OutstandingHouseReportItem {
    return {
      collectionId: item.collection.id,
      collectionDate: item.collection.collectionDate,
      collectionMode: item.collection.collectionMode,
      houseId: item.houseId,
      houseNumber: item.house.houseNumber,
      area: {
        id: item.house.area.id,
        code: item.house.area.code,
        name: item.house.area.name,
      },
      status: item.status,
      amount: item.amount.toString(),
    };
  }

  private publicAnnouncementWhere(rtId: string, query: PublicFeedQuery): Prisma.AnnouncementWhereInput {
    return {
      rtId,
      status: AnnouncementStatus.PUBLISHED,
      visibility: AnnouncementVisibility.PUBLIC,
      publishedAt: { not: null },
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { body: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };
  }

  private async findPublicRt(rtCode: string): Promise<{ id: string; code: string; name: string } | null> {
    return this.prisma.rt.findFirst({
      where: { code: rtCode, isActive: true, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
  }

  private ledgerReportSelect() {
    return {
      id: true,
      cashAccountId: true,
      transactionId: true,
      ledgerSequence: true,
      entryType: true,
      amount: true,
      balanceAfter: true,
      ledgerDate: true,
      transaction: {
        select: {
          id: true,
          type: true,
          status: true,
          categoryId: true,
          category: { select: { id: true, key: true, name: true, type: true } },
        },
      },
      cashAccount: { select: { id: true, key: true, name: true, currency: true } },
    } satisfies Prisma.CashLedgerSelect;
  }

  private reportExportSelect() {
    return {
      id: true,
      rtId: true,
      requestedById: true,
      reportType: true,
      format: true,
      status: true,
      filters: true,
      fileName: true,
      objectKey: true,
      errorMessage: true,
      idempotencyKey: true,
      expiresAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ReportExportSelect;
  }

  private async updateExportStatus(rtId: string, exportId: string, data: Prisma.ReportExportUpdateManyMutationInput): Promise<ReportExportRecord | null> {
    const updated = await this.prisma.reportExport.updateMany({ where: { rtId, id: exportId }, data });
    if (updated.count === 0) {
      return null;
    }
    return this.findExportRequestById(rtId, exportId);
  }

  private toReportExportRecord(row: ReportExportRow): ReportExportRecord {
    return {
      id: row.id,
      rtId: row.rtId,
      requestedById: row.requestedById,
      reportType: row.reportType,
      format: row.format as ReportExportRecord['format'],
      status: this.toExportStatus(row.status),
      filters: this.toRecord(row.filters),
      fileName: row.fileName,
      objectKey: row.objectKey,
      errorMessage: row.errorMessage,
      idempotencyKey: row.idempotencyKey,
      expiresAt: row.expiresAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toExportStatus(status: ReportExportStatus): ReportExportRecord['status'] {
    return status === ReportExportStatus.QUEUED ? 'PENDING' : status;
  }

  private toPrismaExportStatus(status: ReportExportRecord['status']): ReportExportStatus {
    return status === 'PENDING' ? ReportExportStatus.QUEUED : (status as ReportExportStatus);
  }

  private assertExportReplayMatches(existing: ReportExportRow, command: CreateReportExportCommand): void {
    const existingFilters = JSON.stringify(this.toRecord(existing.filters));
    const requestedFilters = JSON.stringify(command.filters ?? {});
    if (existing.reportType !== command.reportType || existing.format !== command.format || existingFilters !== requestedFilters) {
      throw new ConflictException('Report export idempotency replay does not match the original request.');
    }
  }

  private async writeAudit(
    client: AuditClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: ReportRequestMeta;
      action: string;
      entityType: string;
      entityId: string;
      afterData?: unknown;
    },
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private dateFieldRange(query: { dateFrom?: string; dateTo?: string }) {
    return {
      gte: this.startDate(query.dateFrom),
      lte: this.endDate(query.dateTo),
    };
  }

  private startDate(date?: string): Date {
    return new Date(`${date ?? this.currentMonth() + '-01'}T00:00:00.000Z`);
  }

  private endDate(date?: string): Date {
    return new Date(`${date ?? this.endOfMonth(this.currentMonth())}T23:59:59.999Z`);
  }

  private endOfMonth(month: string): string {
    const [year, rawMonth] = month.split('-').map(Number);
    return new Date(Date.UTC(year, rawMonth, 0)).toISOString().slice(0, 10);
  }

  private currentMonth(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private range(query: { dateFrom?: string; dateTo?: string }) {
    return {
      dateFrom: query.dateFrom ?? `${this.currentMonth()}-01`,
      dateTo: query.dateTo ?? this.endOfMonth(this.currentMonth()),
    };
  }

  private reportTypeForPeriod(period: string): string {
    if (period === 'DAILY') return 'DAILY_FINANCE_SUMMARY';
    if (period === 'WEEKLY') return 'WEEKLY_FINANCE_SUMMARY';
    if (period === 'MONTHLY') return 'MONTHLY_FINANCE_SUMMARY';
    if (period === 'YEARLY') return 'YEARLY_FINANCE_SUMMARY';
    return 'CUSTOM_FINANCE_SUMMARY';
  }

  private snapshot(source: ReportSnapshotMeta['source'], cacheStrategy: ReportSnapshotMeta['cacheStrategy']): ReportSnapshotMeta {
    return { generatedAt: new Date(), version: 1, source, cacheStrategy };
  }

  private isPaidCollectionStatus(status: CollectionItemStatus): boolean {
    return status === CollectionItemStatus.PAID || status === CollectionItemStatus.DISPENSATION;
  }

  private isCollectionIncludedInPerformance(status: CollectionStatus, requestedStatus?: CollectionStatus): boolean {
    return requestedStatus ? status === requestedStatus : status === CollectionStatus.SUBMITTED || status === CollectionStatus.VALIDATED;
  }

  private outstandingStatuses(): CollectionItemStatus[] {
    return [
      CollectionItemStatus.UNPAID,
      CollectionItemStatus.HOUSE_EMPTY,
      CollectionItemStatus.LEFT_WITH_NEIGHBOR,
      CollectionItemStatus.TITIP_TETANGGA,
      CollectionItemStatus.OVERDUE,
      CollectionItemStatus.MENUNGGAK,
    ];
  }

  private zero(): Prisma.Decimal {
    return new Prisma.Decimal(0);
  }

  private toRecord(value: Prisma.JsonValue): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
