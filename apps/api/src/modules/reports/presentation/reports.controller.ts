/**
 * Purpose: HTTP controller for private reporting, public transparency, and export request endpoints.
 * Caller: NestJS router.
 * Deps: ReportsService, Auth/RBAC guards, Swagger decorators, request DTOs, and request context type.
 * MainFuncs: Exposes ledger-derived reports, collection/outstanding reports, public-safe endpoints, export lifecycle routes, and CSV downloads.
 * SideEffects: Writes report export/audit rows through ReportsService on export creation, retry, and download.
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import { PublicRoute } from '../../../common/decorators/public-route.decorator';import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { ReportsService } from '../application/reports.service';
import {
  ApprovalActivityReportQueryDto,
  AuditActivityReportQueryDto,
  CollectionReportQueryDto,
  CreateReportExportDto,
  ExpenseCategoryReportQueryDto,
  FinanceReportQueryDto,
  OutstandingReportQueryDto,
  PublicFeedQueryDto,
  PublicMonthlyFinanceQueryDto,
  ReportExportListQueryDto,
} from './dto/report.dto';

@ApiTags('reports')
@ApiBearerAuth()@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Get ledger-derived daily/weekly/monthly/yearly finance summary' })
  @RequireAnyPermission('reports.private.read')
  @Get('finance/summary')
  async financeSummary(@CurrentUser() principal: AuthPrincipal, @Query() query: FinanceReportQueryDto) {
    return this.reportsService.getFinanceSummary(principal, query);
  }

  @ApiOperation({ summary: 'Get ledger-derived cash flow summary' })
  @RequireAnyPermission('reports.private.read')
  @Get('finance/cash-flow')
  async cashFlow(@CurrentUser() principal: AuthPrincipal, @Query() query: FinanceReportQueryDto) {
    return this.reportsService.getCashFlowSummary(principal, query);
  }

  @ApiOperation({ summary: 'Get ledger-derived expense category breakdown' })
  @RequireAnyPermission('reports.private.read')
  @Get('finance/expense-categories')
  async expenseCategories(@CurrentUser() principal: AuthPrincipal, @Query() query: ExpenseCategoryReportQueryDto) {
    return this.reportsService.getExpenseCategoryBreakdown(principal, query);
  }

  @ApiOperation({ summary: 'Get collection performance report' })
  @RequireAnyPermission('reports.private.read', 'collections.read')
  @Get('collections/performance')
  async collectionPerformance(@CurrentUser() principal: AuthPrincipal, @Query() query: CollectionReportQueryDto) {
    return this.reportsService.getCollectionPerformance(principal, query);
  }

  @ApiOperation({ summary: 'Get per-area collection progress report' })
  @RequireAnyPermission('reports.private.read', 'collections.read')
  @Get('collections/per-area-progress')
  async perAreaProgress(@CurrentUser() principal: AuthPrincipal, @Query() query: CollectionReportQueryDto) {
    return this.reportsService.getPerAreaProgress(principal, query);
  }

  @ApiOperation({ summary: 'Get outstanding houses report' })
  @RequireAnyPermission('reports.private.read', 'collections.read')
  @Get('outstanding/houses')
  async outstanding(@CurrentUser() principal: AuthPrincipal, @Query() query: OutstandingReportQueryDto) {
    return this.reportsService.getOutstandingHouses(principal, query);
  }

  @ApiOperation({ summary: 'Get expense approval activity report' })
  @RequireAnyPermission('reports.private.read', 'approvals.read')
  @Get('approvals/activity')
  async approvalActivity(@CurrentUser() principal: AuthPrincipal, @Query() query: ApprovalActivityReportQueryDto) {
    return this.reportsService.getApprovalActivity(principal, query);
  }

  @ApiOperation({ summary: 'Get audit activity summary' })
  @RequireAnyPermission('reports.private.read', 'audit.read')
  @Get('audit/activity')
  async auditActivity(@CurrentUser() principal: AuthPrincipal, @Query() query: AuditActivityReportQueryDto) {
    return this.reportsService.getAuditActivity(principal, query);
  }

  @ApiOperation({ summary: 'Create export request foundation for CSV/PDF/Excel workers' })
  @RequireAnyPermission('reports.export')
  @Post('exports')
  async createExport(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateReportExportDto, @Req() request: RequestWithContext) {
    return this.reportsService.createExport(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'List report export requests' })
  @RequireAnyPermission('reports.export')
  @Get('exports')
  async listExports(@CurrentUser() principal: AuthPrincipal, @Query() query: ReportExportListQueryDto) {
    return this.reportsService.listExports(principal, query);
  }

  @ApiOperation({ summary: 'Get report export request detail' })
  @RequireAnyPermission('reports.export')
  @Get('exports/:exportId')
  async getExport(@CurrentUser() principal: AuthPrincipal, @Param('exportId', ParseUUIDPipe) exportId: string) {
    return this.reportsService.getExport(principal, exportId);
  }

  @ApiOperation({ summary: 'Download completed CSV report export' })
  @RequireAnyPermission('reports.export')
  @Get('exports/:exportId/download')
  async downloadExport(@CurrentUser() principal: AuthPrincipal, @Param('exportId', ParseUUIDPipe) exportId: string, @Req() request: RequestWithContext) {
    return this.streamDownload(await this.reportsService.downloadExport(principal, exportId, this.requestMeta(request)));
  }

  @ApiOperation({ summary: 'Retry a failed report export request' })
  @RequireAnyPermission('reports.export')
  @Post('exports/:exportId/retry')
  async retryExport(@CurrentUser() principal: AuthPrincipal, @Param('exportId', ParseUUIDPipe) exportId: string, @Req() request: RequestWithContext) {
    return this.reportsService.retryExport(principal, exportId, this.requestMeta(request));
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Get public-safe cash balance and income/expense transparency summary' })
  @Get('public/:rtCode/summary')
  async publicSummary(@Param('rtCode') rtCode: string) {
    return this.reportsService.getPublicSummary(rtCode);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Get public-safe monthly finance transparency report' })
  @Get('public/:rtCode/monthly-finance')
  async publicMonthlyFinance(@Param('rtCode') rtCode: string, @Query() query: PublicMonthlyFinanceQueryDto) {
    return this.reportsService.getPublicMonthlyFinance(rtCode, query);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Get public report metadata feed' })
  @Get('public/:rtCode/metadata')
  async publicMetadata(@Param('rtCode') rtCode: string, @Query() query: PublicFeedQueryDto) {
    return this.reportsService.listPublicReportMetadata(rtCode, query);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Get public announcements/report feed' })
  @Get('public/:rtCode/announcements')
  async publicAnnouncements(@Param('rtCode') rtCode: string, @Query() query: PublicFeedQueryDto) {
    return this.reportsService.listPublicAnnouncements(rtCode, query);
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Download public-safe transparency summary CSV' })
  @Get('public/:rtCode/exports/summary.csv')
  async publicSummaryCsv(@Param('rtCode') rtCode: string) {
    return this.streamDownload(await this.reportsService.downloadPublicSummaryCsv(rtCode));
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Download public-safe monthly finance CSV' })
  @Get('public/:rtCode/exports/monthly-finance.csv')
  async publicMonthlyFinanceCsv(@Param('rtCode') rtCode: string, @Query() query: PublicMonthlyFinanceQueryDto) {
    return this.streamDownload(await this.reportsService.downloadPublicMonthlyFinanceCsv(rtCode, query));
  }

  @PublicRoute()
  @ApiOperation({ summary: 'Download public-safe collection summary CSV' })
  @Get('public/:rtCode/exports/collections.csv')
  async publicCollectionsCsv(@Param('rtCode') rtCode: string, @Query() query: PublicMonthlyFinanceQueryDto) {
    return this.streamDownload(await this.reportsService.downloadPublicCollectionCsv(rtCode, query));
  }

  private requestMeta(request: RequestWithContext) {
    return {
      correlationId: request.correlationId,
      userAgent: this.headerValue(request.headers['user-agent']),
      ipAddress: request.ip && isIP(request.ip) ? request.ip : undefined,
    };
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private streamDownload(download: { fileName: string; contentType: string; content: string }) {
    return new StreamableFile(Buffer.from(download.content, 'utf8'), {
      type: download.contentType,
      disposition: `attachment; filename="${download.fileName.replace(/"/g, '')}"`,
    });
  }
}
