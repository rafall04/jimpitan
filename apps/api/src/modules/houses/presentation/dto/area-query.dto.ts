/**
 * Purpose: Query DTO for tenant-scoped area list endpoints.
 * Caller: AreasController.
 * Deps: Swagger, class-transformer, class-validator, pagination DTO.
 * MainFuncs: Validates search, active-state filter, pagination, and sort options.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AreaSortField, SortDirection } from '../../application/houses.commands';

export class AreaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['code', 'name', 'sortOrder', 'createdAt'] })
  @IsOptional()
  @IsIn(['code', 'name', 'sortOrder', 'createdAt'])
  sortBy?: AreaSortField;

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
