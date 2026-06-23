/**
 * Purpose: Tenant guard for RT membership enforcement.
 * Caller: AuthModule exports and tenant-scoped controllers.
 * Deps: NestJS guard interfaces, Reflector, AuthService, request constants and types.
 * MainFuncs: Ensures the access-token tenant matches the requested tenant and resolves active membership.
 * SideEffects: Mutates request context with resolved principal and tenant ID.
 */
import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE_METADATA, SKIP_TENANT_GUARD_METADATA } from '../constants/metadata.constants';
import { TENANT_ID_HEADER } from '../constants/request.constants';
import type { RequestWithContext } from '../types/request-context.type';
import { AuthService } from '../../modules/auth/application/auth.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context) || this.shouldSkipTenantGuard(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const principal = request.user;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required before tenant resolution.');
    }

    const requestedTenantId = this.extractHeaderValue(request.headers[TENANT_ID_HEADER]) ?? principal.rtId;
    if (!requestedTenantId) {
      throw new BadRequestException('Tenant context is required.');
    }
    if (principal.rtId && requestedTenantId !== principal.rtId) {
      throw new ForbiddenException('Tenant context does not match the access token.');
    }

    const resolvedPrincipal = await this.authService.resolvePrincipal(principal.userId, requestedTenantId);
    request.user = resolvedPrincipal;
    request.tenantId = resolvedPrincipal.rtId;
    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  private shouldSkipTenantGuard(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  private extractHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
