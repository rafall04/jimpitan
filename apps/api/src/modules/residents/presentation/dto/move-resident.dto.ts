/**
 * Purpose: Request DTO for moving a resident to another house.
 * Caller: ResidentsController.
 * Deps: Swagger and class-validator.
 * MainFuncs: Validates tenant-scoped target house identifier format.
 * SideEffects: None.
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MoveResidentDto {
  @ApiProperty()
  @IsUUID('4')
  houseId!: string;
}
