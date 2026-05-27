/**
 * Purpose: Request DTO for creating or inviting a user into the current tenant.
 * Caller: UsersController.
 * Deps: class-validator.
 * MainFuncs: Validates safe user creation input and optional role assignments.
 * SideEffects: None.
 */
import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(160)
  initialPassword?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
