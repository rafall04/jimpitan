/**
 * Purpose: Query DTO for tenant-scoped house list endpoints.
 * Caller: HousesController.
 * Deps: Prisma enum, Swagger, class-validator, and pagination DTO.
 * MainFuncs: Validates house search, area/status filters, pagination, and sort options.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HouseStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { HouseSortField, SortDirection } from '../../application/houses.commands';

export class HouseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional({ enum: HouseStatus })
  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;

  @ApiPropertyOptional({ enum: ['houseNumber', 'areaName', 'status', 'createdAt'] })
  @IsOptional()
  @IsIn(['houseNumber', 'areaName', 'status', 'createdAt'])
  sortBy?: HouseSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: SortDirection;
}
