/**
 * Purpose: User, membership, role, and permission response types for identity foundation.
 * Caller: UsersService, UsersController, and repository contracts.
 * Deps: None.
 * MainFuncs: Defines safe identity shapes without password/session secrets.
 * SideEffects: None.
 */
export type SafeUserProfile = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RoleSummary = {
  id: string;
  key: string;
  name: string;
  rtId: string | null;
  isSystem: boolean;
};

export type RoleWithPermissions = RoleSummary & {
  permissions: string[];
};

export type MembershipSummary = {
  id: string;
  rtId: string;
  status: string;
  roles: RoleSummary[];
};

export type TenantMembershipRow = MembershipSummary & {
  user: SafeUserProfile;
};

export type CreateUserResult = {
  user: SafeUserProfile;
  membership: MembershipSummary;
};
