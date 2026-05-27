/**
 * Purpose: Application service for Auth foundation use cases.
 * Caller: AuthController, auth guards, and unit tests.
 * Deps: Auth repository port, password hasher port, JWT token port.
 * MainFuncs: Handles login, refresh rotation, logout, and current principal resolution.
 * SideEffects: Persists refresh sessions and auth audit records through the repository port.
 */
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AUTH_REPOSITORY, AUTH_TOKEN_SERVICE, PASSWORD_HASHER } from '../auth.tokens';
import type { LoginCommand, RefreshTokenCommand, LogoutCommand, ChangePasswordCommand } from './auth.commands';
import type { AuthUseCases, LoginResult } from './auth.use-cases';
import type { AccessTokenPayload, AuthLoginIdentity, AuthPrincipal, IssuedAuthTokens, SafeAuthUser } from '../domain/auth.types';
import type { AuthRepositoryPort } from '../infrastructure/auth.repository.port';
import type { AuthTokenPort } from '../infrastructure/auth-token.port';
import type { PasswordHasherPort } from '../infrastructure/password-hasher.port';

@Injectable()
export class AuthService implements AuthUseCases {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepository: AuthRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(AUTH_TOKEN_SERVICE) private readonly tokenService: AuthTokenPort,
    private readonly sessionIdFactory: () => string = randomUUID,
  ) {}

  async login(command: LoginCommand): Promise<LoginResult> {
    const identity = await this.authRepository.findLoginIdentity(command.identifier);
    if (!identity?.user.passwordHash) {
      await this.writeAudit('AUTH_LOGIN_FAILED', command);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await this.passwordHasher.verify(command.password, identity.user.passwordHash);
    if (!passwordMatches) {
      await this.writeAudit('AUTH_LOGIN_FAILED', command, identity.user.id);
      throw new UnauthorizedException('Invalid credentials.');
    }

    const principal = await this.resolvePrincipalFromIdentityOrReject(identity, command);
    const tokens = await this.issueTokens(principal, command);
    await this.writeAudit('AUTH_LOGIN', command, identity.user.id, principal.rtId);

    return {
      user: this.toSafeUser(identity.user),
      principal,
      tokens,
    };
  }

  async refresh(command: RefreshTokenCommand): Promise<IssuedAuthTokens> {
    const refreshPayload = await this.tokenService.verifyRefreshToken(command.refreshToken);
    const session = await this.authRepository.findRefreshSession(refreshPayload.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      await this.writeAudit('AUTH_REFRESH_FAILED', command, refreshPayload.sub);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const refreshMatches = await this.passwordHasher.verify(command.refreshToken, session.refreshTokenHash);
    if (!refreshMatches) {
      await this.authRepository.revokeRefreshSession(refreshPayload.sessionId);
      await this.writeAudit('AUTH_REFRESH_REPLAY_DETECTED', command, refreshPayload.sub, refreshPayload.rtId);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const principal = await this.resolvePrincipal(refreshPayload.sub, refreshPayload.rtId);
    const accessToken = await this.tokenService.signAccessToken(this.toAccessTokenPayload(principal));
    const nextRefreshToken = await this.tokenService.signRefreshToken({
      sub: refreshPayload.sub,
      sessionId: refreshPayload.sessionId,
      rtId: principal.rtId,
    });
    const refreshTokenHash = await this.passwordHasher.hash(nextRefreshToken);
    const rotated = await this.authRepository.rotateRefreshSession({
      sessionId: refreshPayload.sessionId,
      currentRefreshTokenHash: session.refreshTokenHash,
      refreshTokenHash,
      expiresAt: this.tokenService.getRefreshExpiresAt(),
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
    });
    if (!rotated) {
      await this.authRepository.revokeRefreshSession(refreshPayload.sessionId);
      await this.writeAudit('AUTH_REFRESH_FAILED', command, refreshPayload.sub, principal.rtId);
      throw new UnauthorizedException('Invalid refresh token.');
    }
    await this.writeAudit('AUTH_REFRESH', command, refreshPayload.sub, principal.rtId);

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresInSeconds: this.tokenService.getAccessExpiresInSeconds(),
    };
  }

  async logout(command: LogoutCommand): Promise<void> {
    const refreshPayload = await this.tokenService.verifyRefreshToken(command.refreshToken);
    const session = await this.authRepository.findRefreshSession(refreshPayload.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      await this.writeAudit('AUTH_LOGOUT_FAILED', command, refreshPayload.sub, refreshPayload.rtId);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const refreshMatches = await this.passwordHasher.verify(command.refreshToken, session.refreshTokenHash);
    if (!refreshMatches) {
      await this.writeAudit('AUTH_LOGOUT_FAILED', command, refreshPayload.sub, refreshPayload.rtId);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    await this.authRepository.revokeRefreshSession(refreshPayload.sessionId);
    await this.writeAudit('AUTH_LOGOUT', command, refreshPayload.sub, refreshPayload.rtId);
  }

  async changePassword(_command: ChangePasswordCommand): Promise<void> {
    throw new UnauthorizedException('Password change is not implemented in this foundation phase.');
  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenPayload> {
    return this.tokenService.verifyAccessToken(accessToken);
  }

  async getPrincipalFromAccessToken(accessToken: string): Promise<AuthPrincipal> {
    const payload = await this.verifyAccessToken(accessToken);
    return this.resolvePrincipal(payload.sub, payload.rtId);
  }

  async resolvePrincipal(userId: string, rtId?: string): Promise<AuthPrincipal> {
    const principal = await this.authRepository.resolvePrincipal(userId, rtId);
    if (!principal) {
      throw new UnauthorizedException('Tenant membership is not available.');
    }
    return principal;
  }

  private async issueTokens(principal: AuthPrincipal, command: LoginCommand): Promise<IssuedAuthTokens> {
    const sessionId = this.sessionIdFactory();
    const accessToken = await this.tokenService.signAccessToken(this.toAccessTokenPayload(principal));
    const refreshToken = await this.tokenService.signRefreshToken({ sub: principal.userId, sessionId, rtId: principal.rtId });
    const refreshTokenHash = await this.passwordHasher.hash(refreshToken);
    await this.authRepository.createRefreshSession({
      id: sessionId,
      userId: principal.userId,
      refreshTokenHash,
      expiresAt: this.tokenService.getRefreshExpiresAt(),
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.tokenService.getAccessExpiresInSeconds(),
    };
  }

  private async resolvePrincipalFromIdentityOrReject(identity: AuthLoginIdentity, command: LoginCommand): Promise<AuthPrincipal> {
    if (!command.rtId && identity.memberships.length !== 1) {
      await this.writeAudit('AUTH_LOGIN_FAILED', command, identity.user.id);
      throw new UnauthorizedException('Tenant context is required.');
    }

    const membership = command.rtId
      ? identity.memberships.find((candidate) => candidate.rtId === command.rtId)
      : identity.memberships[0];
    if (!membership) {
      await this.writeAudit('AUTH_LOGIN_FAILED', command, identity.user.id, command.rtId);
      throw new UnauthorizedException('Tenant membership is not available.');
    }

    return {
      userId: identity.user.id,
      membershipId: membership.id,
      rtId: membership.rtId,
      roles: membership.roles,
      permissions: membership.permissions,
    };
  }

  private toAccessTokenPayload(principal: AuthPrincipal): AccessTokenPayload {
    return {
      sub: principal.userId,
      membershipId: principal.membershipId,
      rtId: principal.rtId,
      roles: principal.roles,
      permissions: principal.permissions,
    };
  }

  private toSafeUser(user: AuthLoginIdentity['user']): SafeAuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
    };
  }

  private async writeAudit(action: string, command: { correlationId?: string; ipAddress?: string; userAgent?: string }, userId?: string, rtId?: string): Promise<void> {
    await this.authRepository.writeAuthAudit({
      action,
      userId,
      rtId,
      correlationId: command.correlationId,
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });
  }
}
