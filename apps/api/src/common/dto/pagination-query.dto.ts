/**
 * Purpose: Shared pagination query DTO for list endpoints.
 * Caller: Tenant and user controllers.
 * Deps: class-transformer and class-validator.
 * MainFuncs: Validates page/limit parameters with safe defaults and maximum page size.
 * SideEffects: None.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
