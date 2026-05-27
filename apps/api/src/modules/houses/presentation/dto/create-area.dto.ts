/**
 * Purpose: Request DTO for creating an RT area/block.
 * Caller: AreasController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates area code, name, and route ordering metadata.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
