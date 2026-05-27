/**
 * Purpose: Request DTO for creating an RT house.
 * Caller: HousesController.
 * Deps: Prisma enum, Swagger, and class-validator.
 * MainFuncs: Validates house number, area assignment, occupancy state, and address metadata.
 * SideEffects: None.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HouseStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateHouseDto {
  @ApiProperty()
  @IsUUID('4')
  areaId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  houseNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressNote?: string;

  @ApiPropertyOptional({ enum: HouseStatus })
  @IsOptional()
  @IsEnum(HouseStatus)
  status?: HouseStatus;
}
