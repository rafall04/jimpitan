/**
 * Purpose: JWT adapter for Auth access and refresh token operations.
 * Caller: AuthModule dependency injection for AuthService and auth guards.
 * Deps: NestJS JwtService, ConfigService, Auth token payload types.
 * MainFuncs: Signs and verifies scoped access tokens and session-bound refresh tokens with runtime claim validation.
 * SideEffects: Reads runtime JWT configuration and creates signed token strings.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, RefreshTokenPayload } from '../domain/auth.types';
import type { AuthTokenPort } from './auth-token.port';

@Injectable()
export class JwtAuthTokenService implements AuthTokenPort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.getAccessExpiresInSeconds(),
      algorithm: 'HS256',
    });
  }

  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.getRefreshTtlSeconds(),
      algorithm: 'HS256',
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      algorithms: ['HS256'],
    });
    if (!this.isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Invalid access token claims.');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      algorithms: ['HS256'],
    });
    if (!this.isRefreshTokenPayload(payload)) {
      throw new UnauthorizedException('Invalid refresh token claims.');
    }

    return payload;
  }

  getAccessExpiresInSeconds(): number {
    return this.config.get<number>('jwt.accessTtlSeconds', 900);
  }

  getRefreshExpiresAt(): Date {
    return new Date(Date.now() + this.getRefreshTtlSeconds() * 1000);
  }

  private getRefreshTtlSeconds(): number {
    return this.config.get<number>('jwt.refreshTtlSeconds', 2592000);
  }

  private isAccessTokenPayload(payload: unknown): payload is AccessTokenPayload {
    if (!this.isRecord(payload)) {
      return false;
    }

    return (
      this.isNonEmptyString(payload.sub) &&
      this.isNonEmptyString(payload.membershipId) &&
      this.isNonEmptyString(payload.rtId) &&
      this.isStringArray(payload.roles) &&
      this.isStringArray(payload.permissions)
    );
  }

  private isRefreshTokenPayload(payload: unknown): payload is RefreshTokenPayload {
    if (!this.isRecord(payload)) {
      return false;
    }

    return this.isNonEmptyString(payload.sub) && this.isNonEmptyString(payload.sessionId) && this.isNonEmptyString(payload.rtId);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }
}
