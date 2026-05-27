/**
 * Purpose: Request DTO for replacing tenant role permission assignments.
 * Caller: UsersController.
 * Deps: class-validator.
 * MainFuncs: Validates permission ID arrays for tenant-scoped permission assignment.
 * SideEffects: None.
 */
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
