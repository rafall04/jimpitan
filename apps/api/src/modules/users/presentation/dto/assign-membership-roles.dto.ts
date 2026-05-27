/**
 * Purpose: Request DTO for replacing membership role assignments.
 * Caller: UsersController.
 * Deps: class-validator.
 * MainFuncs: Validates role ID arrays for tenant-scoped role assignment.
 * SideEffects: None.
 */
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignMembershipRolesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds!: string[];
}
