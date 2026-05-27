/**
 * Purpose: Query DTO for tenant-scoped resident list endpoints.
 * Caller: ResidentsController.
 * Deps: Prisma enum, Swagger, class-transformer, class-validator, and pagination DTO.
 * MainFuncs: Validates resident search, house/area/status filters, archive inclusion, pagination, and sort options.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResidentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { ResidentSortField, SortDirection } from '../../application/residents.commands';

export class ResidentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  houseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional({ enum: ResidentStatus })
  @IsOptional()
  @IsEnum(ResidentStatus)
  status?: ResidentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({ enum: ['fullName', 'houseNumber', 'areaName', 'status', 'createdAt'] })
  @IsOptional()
  @IsIn(['fullName', 'houseNumber', 'areaName', 'status', 'createdAt'])
  sortBy?: ResidentSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: SortDirection;
}

function toOptionalBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}
