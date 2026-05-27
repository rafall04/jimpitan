/**
 * Purpose: Request DTO for cancelling a jimpitan collection session.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates required cancellation reasons.
 * SideEffects: None.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelCollectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  cancellationReason!: string;
}
