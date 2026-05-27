/**
 * Purpose: HTTP controller for authentication foundation endpoints.
 * Caller: NestJS router.
 * Deps: Node net IP validation, AuthService, auth DTOs, request context decorators, auth guard.
 * MainFuncs: Exposes login, refresh, logout, and current-principal endpoints.
 * SideEffects: Persists sessions and auth audit logs through AuthService.
 */
import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PublicRoute } from '../../../common/decorators/public-route.decorator';
import { AuthenticationGuard } from '../../../common/guards/authentication.guard';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import { AuthService } from '../application/auth.service';
import type { LoginResult } from '../application/auth.use-cases';
import type { AuthPrincipal, IssuedAuthTokens } from '../domain/auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @PublicRoute()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() request: RequestWithContext): Promise<LoginResult> {
    return this.authService.login({
      identifier: dto.identifier.trim(),
      password: dto.password,
      rtId: dto.rtId,
      correlationId: request.correlationId,
      userAgent: this.extractHeaderValue(request.headers['user-agent']),
      ipAddress: this.extractClientIp(request),
    });
  }

  @PublicRoute()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: RequestWithContext): Promise<IssuedAuthTokens> {
    return this.authService.refresh({
      refreshToken: dto.refreshToken,
      correlationId: request.correlationId,
      userAgent: this.extractHeaderValue(request.headers['user-agent']),
      ipAddress: this.extractClientIp(request),
    });
  }

  @PublicRoute()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto, @Req() request: RequestWithContext): Promise<void> {
    await this.authService.logout({
      refreshToken: dto.refreshToken,
      correlationId: request.correlationId,
      userAgent: this.extractHeaderValue(request.headers['user-agent']),
      ipAddress: this.extractClientIp(request),
    });
  }

  @ApiBearerAuth()
  @UseGuards(AuthenticationGuard)
  @Get('me')
  async me(@CurrentUser() principal: AuthPrincipal): Promise<{ principal: AuthPrincipal }> {
    return { principal };
  }

  private extractHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }

  private extractClientIp(request: RequestWithContext): string | undefined {
    return request.ip && isIP(request.ip) ? request.ip : undefined;
  }
}
