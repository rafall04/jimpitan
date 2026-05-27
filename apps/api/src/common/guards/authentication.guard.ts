/**
 * Purpose: JWT authentication guard for protected HTTP routes.
 * Caller: AuthModule exports and private controllers.
 * Deps: NestJS guard interfaces, Reflector, AuthService, request context types.
 * MainFuncs: Skips public routes, validates bearer access tokens, and attaches current principal.
 * SideEffects: Mutates request context with user and tenant IDs.
 */
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE_METADATA } from '../constants/metadata.constants';
import type { RequestWithContext } from '../types/request-context.type';
import { AuthService } from '../../modules/auth/application/auth.service';

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const accessToken = this.extractBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const principal = await this.authService.getPrincipalFromAccessToken(accessToken);
    request.user = principal;
    request.tenantId = principal.rtId;
    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  private extractBearerToken(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) {
      return null;
    }

    const parts = value.split(' ');
    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
