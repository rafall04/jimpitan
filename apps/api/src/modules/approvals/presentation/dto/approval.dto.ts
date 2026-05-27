/**
 * Purpose: Request and query DTOs for expense approval workflow endpoints.
 * Caller: ApprovalsController.
 * Deps: Swagger, class-validator, Prisma enums, and pagination DTO.
 * MainFuncs: Validates approval filters, policy updates, request payloads, decisions, and cancellation requests.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { ApprovalSortDirection } from '../../application/approvals.commands';

export class ApprovalListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  transactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  approverMembershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'status'])
  sortBy?: 'createdAt' | 'updatedAt' | 'status';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: ApprovalSortDirection;
}

export class ApprovalQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED] })
  @IsOptional()
  @IsIn([ApprovalStatus.PENDING, ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.CANCELLED])
  status?: Extract<ApprovalStatus, 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt'] })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: ApprovalSortDirection;
}

export class RequestExpenseApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class ApprovalDecisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}

export class RejectApprovalDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  decisionNote!: string;
}

export class CancelApprovalDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  reason!: string;
}

export class UpdateApprovalPolicyDto {
  @ApiProperty({ example: '50000' })
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,2})?$/)
  thresholdAmount!: string;

  @ApiProperty()
  @IsBoolean()
  autoApproveBelowThreshold!: boolean;

  @ApiProperty()
  @IsBoolean()
  preventSelfApproval!: boolean;

  @ApiProperty({ type: [String], example: ['KETUA_RT'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  approverRoleKeys!: string[];

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  requiredApprovals!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
