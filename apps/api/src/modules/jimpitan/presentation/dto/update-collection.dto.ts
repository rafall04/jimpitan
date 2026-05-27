/**
 * Purpose: Request DTO for updating a jimpitan collection session.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates officer reassignment, date/route reassignment, mode changes, optional bulk total, and notes before validation.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { COLLECTION_MODES, type CollectionMode } from '../../domain/collection-mode.types';

export class UpdateCollectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  officerMembershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  collectionDate?: string;

  @ApiPropertyOptional({ enum: COLLECTION_MODES })
  @IsOptional()
  @IsIn(COLLECTION_MODES)
  collectionMode?: CollectionMode;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,11}$/)
  totalAmount?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  areaId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
