/**
 * Purpose: Request DTO for rejecting a submitted jimpitan collection.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates required rejection reasons.
 * SideEffects: None.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectCollectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  rejectionReason!: string;
}
