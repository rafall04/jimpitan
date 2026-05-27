/**
 * Purpose: Query DTO for tenant-scoped jimpitan collection list endpoints.
 * Caller: JimpitanController.
 * Deps: Prisma collection status enum, Swagger, class-validator, and pagination DTO.
 * MainFuncs: Validates collection status/mode/date/officer/area/search filters and sort options.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CollectionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { COLLECTION_MODES, type CollectionMode } from '../../domain/collection-mode.types';
import type { CollectionSortField, SortDirection } from '../../application/jimpitan.commands';

export class CollectionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CollectionStatus })
  @IsOptional()
  @IsEnum(CollectionStatus)
  status?: CollectionStatus;

  @ApiPropertyOptional({ enum: COLLECTION_MODES })
  @IsOptional()
  @IsIn(COLLECTION_MODES)
  collectionMode?: CollectionMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  officerMembershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

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
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: ['collectionDate', 'status', 'updatedAt'] })
  @IsOptional()
  @IsIn(['collectionDate', 'status', 'updatedAt'])
  sortBy?: CollectionSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: SortDirection;
}
