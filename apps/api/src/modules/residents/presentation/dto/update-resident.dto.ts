/**
 * Purpose: Request DTO for updating a resident in the current RT.
 * Caller: ResidentsController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates partial resident profile, contribution default, notes, and Telegram binding changes.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateResidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+()\-\s]{6,32}$/)
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  defaultJimpitanAmount?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  telegramAccountId?: string | null;
}
