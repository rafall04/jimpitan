/**
 * Purpose: Request DTO for submitting a jimpitan collection session.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates optional idempotency-style submit request identifiers.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCollectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  submitRequestId?: string;
}
