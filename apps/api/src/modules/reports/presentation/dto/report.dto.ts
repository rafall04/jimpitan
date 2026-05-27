/**
 * Purpose: Request DTOs for private reporting, public transparency feeds, and export requests.
 * Caller: ReportsController.
 * Deps: Swagger, class-validator, class-transformer, Prisma enums, pagination DTO, and report command types.
 * MainFuncs: Validates date ranges, report filters, public month inputs, export formats, and pagination.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus, CollectionItemStatus, CollectionStatus, ReportExportFormat } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { ReportExportVisibility, ReportPeriod, ReportSortDirection, ReportType } from '../../application/reports.commands';

export const REPORT_TYPES: ReportType[] = [
  'DAILY_FINANCE_SUMMARY',
  'WEEKLY_FINANCE_SUMMARY',
  'MONTHLY_FINANCE_SUMMARY',
  'YEARLY_FINANCE_SUMMARY',
  'FINANCE_SUMMARY',
  'COLLECTION_PERFORMANCE',
  'COLLECTION_SUMMARY',
  'OUTSTANDING_HOUSES',
  'PER_AREA_COLLECTION_PROGRESS',
  'EXPENSE_CATEGORY_BREAKDOWN',
  'CASH_FLOW_SUMMARY',
  'APPROVAL_ACTIVITY',
  'AUDIT_ACTIVITY',
  'LEDGER_EXPORT',
  'TRANSACTION_EXPORT',
  'PUBLIC_TRANSPARENCY_SUMMARY',
  'PUBLIC_MONTHLY_FINANCE',
];

export const REPORT_EXPORT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'] as const;
export const REPORT_EXPORT_VISIBILITIES: ReportExportVisibility[] = ['PRIVATE', 'PUBLIC_SAFE'];

export class ReportDateRangeDto {
  @ApiPropertyOptional({ enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] })
  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'])
  period?: ReportPeriod;

  @ApiPropertyOptional({ example: '2030-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2030-01-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;
}

export class FinanceReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cashAccountId?: string;
}

export class CollectionReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  collectionStatus?: CollectionStatus;
}

export class OutstandingReportQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2030-01-01' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2030-01-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  collectionId?: string;

  @ApiPropertyOptional({ enum: CollectionItemStatus })
  @IsOptional()
  @IsEnum(CollectionItemStatus)
  status?: CollectionItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: ReportSortDirection;
}

export class ExpenseCategoryReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;
}

export class ApprovalActivityReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
}

export class AuditActivityReportQueryDto extends ReportDateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;
}

export class PublicMonthlyFinanceQueryDto {
  @ApiProperty({ example: '2030-01' })
  @Matches(/^\d{4}-\d{2}$/)
  month!: string;
}

export class PublicFeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class CreateReportExportDto {
  @ApiProperty({ enum: REPORT_TYPES })
  @IsIn(REPORT_TYPES)
  reportType!: ReportType;

  @ApiProperty({ enum: ReportExportFormat })
  @IsEnum(ReportExportFormat)
  format!: ReportExportFormat;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  filters?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional({ enum: REPORT_EXPORT_VISIBILITIES })
  @IsOptional()
  @IsIn(REPORT_EXPORT_VISIBILITIES)
  visibility?: ReportExportVisibility;
}

export class ReportExportListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REPORT_TYPES })
  @IsOptional()
  @IsIn(REPORT_TYPES)
  reportType?: ReportType;

  @ApiPropertyOptional({ enum: REPORT_EXPORT_STATUSES })
  @IsOptional()
  @IsIn(REPORT_EXPORT_STATUSES)
  status?: (typeof REPORT_EXPORT_STATUSES)[number];
}
