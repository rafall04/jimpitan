/**
 * Purpose: Request DTO for entering BULK_TOTAL collection totals.
 * Caller: JimpitanController bulk-total endpoint.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates positive integer currency totals and optional notes for mode-aware bulk total input.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SetBulkTotalDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[1-9]\d{0,11}$/)
  totalAmount!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
