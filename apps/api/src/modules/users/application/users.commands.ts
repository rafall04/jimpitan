/**
 * Purpose: Command contracts for user and membership foundation use cases.
 * Caller: UsersController and UsersService.
 * Deps: None.
 * MainFuncs: Defines validated command shapes plus audit request metadata.
 * SideEffects: None.
 */
export type IdentityRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateUserCommand = {
  fullName: string;
  email?: string;
  phone?: string;
  initialPassword?: string;
  roleIds?: string[];
};

export type UpdateUserCommand = {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
};

export type CreateMembershipCommand = {
  roleIds?: string[];
};

export type AssignMembershipRolesCommand = {
  roleIds: string[];
};

export type AssignRolePermissionsCommand = {
  permissionIds: string[];
};
