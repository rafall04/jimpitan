/**
 * Purpose: Request DTO for validating a submitted jimpitan collection.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates optional treasurer validation notes.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ValidateCollectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  validationNote?: string;
}
