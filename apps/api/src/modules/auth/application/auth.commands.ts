/**
 * Purpose: Command contracts for Auth application use cases.
 * Caller: AuthController and AuthService implementations.
 * Deps: None.
 * MainFuncs: Defines request-shaped command objects without implementing workflows.
 * SideEffects: None.
 */
export type LoginCommand = {
  identifier: string;
  password: string;
  rtId?: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
};

export type RefreshTokenCommand = {
  refreshToken: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
};

export type LogoutCommand = {
  refreshToken: string;
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
};

export type ChangePasswordCommand = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};
