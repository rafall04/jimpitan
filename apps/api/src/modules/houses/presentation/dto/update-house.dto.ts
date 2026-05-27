/**
 * Purpose: Request DTO for updating an RT house.
 * Caller: HousesController.
 * Deps: Prisma enum, Swagger, and class-validator.
 * MainFuncs: Validates partial house number, area assignment, occupancy state, and address changes.
 * SideEffects: None.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { HouseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateHouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  areaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  houseNumber?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressNote?: string | null;

  @ApiPropertyOptional({ enum: HouseStatus })
  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;
}
