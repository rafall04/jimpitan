/**
 * Purpose: Request and query DTOs for finance cash account endpoints.
 * Caller: CashAccountsController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates tenant-scoped cash account create/update/archive/list payloads.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { FinanceSortDirection } from '../../application/finance.commands';

export class CashAccountQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['name', 'key', 'updatedAt'] })
  @IsOptional()
  @IsIn(['name', 'key', 'updatedAt'])
  sortBy?: 'name' | 'key' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: FinanceSortDirection;
}

export class CreateCashAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,78}[a-z0-9]$/)
  key?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ default: 'IDR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}

export class UpdateCashAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ArchiveCashAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason!: string;
}
