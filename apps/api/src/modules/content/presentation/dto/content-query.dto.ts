/**
 * Purpose: Query DTO for the tenant-scoped content list (authoring).
 * Caller: ContentController list route via the global ValidationPipe.
 * Deps: class-validator, shared pagination DTO, Prisma ContentType + AnnouncementStatus enums.
 * MainFuncs: Validates pagination plus optional type/status/search filters.
 * SideEffects: None.
 */
import { AnnouncementStatus, ContentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class ContentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsEnum(AnnouncementStatus)
  status?: AnnouncementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
