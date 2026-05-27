/**
 * Purpose: Request DTO for creating RT tenants.
 * Caller: TenantsController.
 * Deps: class-validator.
 * MainFuncs: Validates minimal RT tenant creation input.
 * SideEffects: None.
 */
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
