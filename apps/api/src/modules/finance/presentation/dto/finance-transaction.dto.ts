/**
 * Purpose: Request and query DTOs for finance transaction lifecycle endpoints.
 * Caller: FinanceTransactionsController.
 * Deps: Swagger, class-validator, Prisma enums, and pagination DTO.
 * MainFuncs: Validates income/expense drafts, validation, rejection, void, post, dedicated collection post, list, and sorting payloads.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { FinanceSortDirection } from '../../application/finance.commands';

export class FinanceTransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: [TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.ADJUSTMENT] })
  @IsOptional()
  @IsIn([TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.ADJUSTMENT])
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE' | 'ADJUSTMENT'>;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cashAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  sourceCollectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['transactionDate', 'status', 'updatedAt', 'amount'] })
  @IsOptional()
  @IsIn(['transactionDate', 'status', 'updatedAt', 'amount'])
  sortBy?: 'transactionDate' | 'status' | 'updatedAt' | 'amount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: FinanceSortDirection;
}

export class CreateFinanceTransactionDto {
  @ApiProperty()
  @IsUUID('4')
  cashAccountId!: string;

  @ApiProperty()
  @IsUUID('4')
  categoryId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  description!: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  transactionDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;

}

export class ValidateFinanceTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  validationNote?: string;
}

export class RejectFinanceTransactionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  rejectionReason!: string;
}

export class VoidFinanceTransactionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  voidReason!: string;
}

export class PostFinanceTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class PostValidatedCollectionDto {
  @ApiProperty()
  @IsUUID('4')
  collectionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  cashAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}
