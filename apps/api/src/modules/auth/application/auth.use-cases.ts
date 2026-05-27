/**
 * Purpose: Use-case contract for future Auth application behavior.
 * Caller: AuthController and future AuthService implementation.
 * Deps: Auth command and domain types.
 * MainFuncs: Defines Auth module behavior surface without internal logic.
 * SideEffects: None.
 */
import type { LoginCommand, RefreshTokenCommand, LogoutCommand, ChangePasswordCommand } from './auth.commands';
import type { AccessTokenPayload, AuthPrincipal, IssuedAuthTokens, SafeAuthUser } from '../domain/auth.types';

export type LoginResult = {
  user: SafeAuthUser;
  principal: AuthPrincipal;
  tokens: IssuedAuthTokens;
};

export interface AuthUseCases {
  login(command: LoginCommand): Promise<LoginResult>;
  refresh(command: RefreshTokenCommand): Promise<IssuedAuthTokens>;
  logout(command: LogoutCommand): Promise<void>;
  changePassword(command: ChangePasswordCommand): Promise<void>;
  getPrincipalFromAccessToken(accessToken: string): Promise<AuthPrincipal>;
  resolvePrincipal(userId: string, rtId?: string): Promise<AuthPrincipal>;
  verifyAccessToken(accessToken: string): Promise<AccessTokenPayload>;
}
