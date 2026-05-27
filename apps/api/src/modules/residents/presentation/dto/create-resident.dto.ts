/**
 * Purpose: Request DTO for creating a resident in the current RT.
 * Caller: ResidentsController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates resident identity, house assignment, default jimpitan amount, notes, and optional Telegram binding.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateResidentDto {
  @ApiProperty()
  @IsUUID('4')
  houseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{6,32}$/)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultJimpitanAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  telegramAccountId?: string;
}
