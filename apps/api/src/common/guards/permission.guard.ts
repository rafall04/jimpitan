/**
 * Purpose: Permission guard for route-level RBAC enforcement.
 * Caller: RbacModule exports and protected controllers with RequirePermissions metadata.
 * Deps: NestJS guard interfaces, Reflector, RbacService, metadata constants, request context.
 * MainFuncs: Reads route requirements and evaluates current principal permissions.
 * SideEffects: None beyond authorization failure exceptions.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_ROUTE_METADATA, PERMISSION_REQUIREMENT_METADATA } from '../constants/metadata.constants';
import type { RequestWithContext } from '../types/request-context.type';
import { RbacService } from '../../modules/rbac/application/rbac.service';
import type { PermissionRequirement } from '../../modules/rbac/domain/rbac.types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublicRoute(context)) {
      return true;
    }

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_REQUIREMENT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication is required before permission checks.');
    }

    const allowed = await this.rbacService.canAccess(request.user, requirement);
    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }
}
