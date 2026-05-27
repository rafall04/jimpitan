/**
 * Purpose: Query DTO for tenant-scoped cash ledger read endpoints.
 * Caller: LedgerController.
 * Deps: Swagger, class-validator, and pagination DTO.
 * MainFuncs: Validates ledger account, transaction, date range, pagination, and sorting filters.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { LedgerSortDirection } from '../../application/ledger.commands';

export class LedgerEntryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cashAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: LedgerSortDirection;
}
