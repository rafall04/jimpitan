/**
 * Purpose: Request DTOs for jimpitan collection item batch input.
 * Caller: JimpitanController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates mobile-friendly house collection item batches with allowed statuses and amount rules.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CollectionItemInputStatus } from '../../domain/jimpitan.types';

export const COLLECTION_ITEM_INPUT_STATUSES = ['PAID', 'UNPAID', 'HOUSE_EMPTY', 'TITIP_TETANGGA', 'MENUNGGAK', 'DISPENSATION'] as const;

export class CollectionItemDto {
  @ApiProperty()
  @IsUUID('4')
  houseId!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  residentId?: string | null;

  @ApiProperty()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/)
  amount!: string;

  @ApiProperty({ enum: COLLECTION_ITEM_INPUT_STATUSES })
  @IsIn(COLLECTION_ITEM_INPUT_STATUSES)
  status!: CollectionItemInputStatus;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpsertCollectionItemsDto {
  @ApiProperty({ type: [CollectionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CollectionItemDto)
  items!: CollectionItemDto[];
}
