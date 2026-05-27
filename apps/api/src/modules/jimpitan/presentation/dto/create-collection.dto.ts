/**
 * Purpose: Request DTO for creating a jimpitan collection session.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates officer assignment, collection date, collection mode, route area, optional bulk total, and session notes.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { COLLECTION_MODES, type CollectionMode } from '../../domain/collection-mode.types';

export class CreateCollectionDto {
  @ApiProperty()
  @IsUUID('4')
  officerMembershipId!: string;

  @ApiProperty()
  @IsDateString({ strict: true })
  collectionDate!: string;

  @ApiPropertyOptional({ enum: COLLECTION_MODES, default: 'PER_HOUSE' })
  @IsOptional()
  @IsIn(COLLECTION_MODES)
  collectionMode?: CollectionMode;

  @ApiPropertyOptional({ description: 'Optional initial total for BULK_TOTAL sessions; PER_HOUSE totals are calculated from items.' })
  @IsOptional()
  @IsString()
  @Matches(/^[1-9]\d{0,11}$/)
  totalAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
