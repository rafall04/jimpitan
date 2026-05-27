/**
 * Purpose: Request DTO for creating a tenant membership for an existing user.
 * Caller: UsersController.
 * Deps: class-validator.
 * MainFuncs: Validates optional role assignments for membership creation.
 * SideEffects: None.
 */
import { ArrayUnique, IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}
