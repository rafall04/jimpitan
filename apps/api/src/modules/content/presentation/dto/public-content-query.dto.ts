/**
 * Purpose: Query DTO for the public content feed.
 * Caller: PublicContentController list route via the global ValidationPipe.
 * Deps: class-validator, shared pagination DTO, Prisma ContentType enum.
 * MainFuncs: Validates pagination plus optional type/search filters for public reads.
 * SideEffects: None.
 */
import { ContentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class PublicContentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ContentType)
  type?: ContentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
