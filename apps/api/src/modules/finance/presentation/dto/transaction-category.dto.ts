/**
 * Purpose: Request and query DTOs for finance transaction category endpoints.
 * Caller: TransactionCategoriesController.
 * Deps: Swagger, class-validator, and Prisma transaction type enum.
 * MainFuncs: Validates income/expense category create/update/archive/list payloads.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { FinanceSortDirection } from '../../application/finance.commands';

export const CATEGORY_TRANSACTION_TYPES = [TransactionType.INCOME, TransactionType.EXPENSE] as const;

export class TransactionCategoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CATEGORY_TRANSACTION_TYPES })
  @IsOptional()
  @IsIn(CATEGORY_TRANSACTION_TYPES)
  type?: (typeof CATEGORY_TRANSACTION_TYPES)[number];

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

export class CreateTransactionCategoryDto {
  @ApiProperty({ enum: CATEGORY_TRANSACTION_TYPES })
  @IsIn(CATEGORY_TRANSACTION_TYPES)
  type!: (typeof CATEGORY_TRANSACTION_TYPES)[number];

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,78}[a-z0-9]$/)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class UpdateTransactionCategoryDto {
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

export class ArchiveTransactionCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason!: string;
}
