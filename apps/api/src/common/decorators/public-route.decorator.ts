/**
 * Purpose: Marks controller handlers/classes that bypass authentication guards.
 * Caller: AuthController and future public route controllers.
 * Deps: NestJS metadata API and metadata constants.
 * MainFuncs: Stores public-route metadata for auth, tenant, and permission guards.
 * SideEffects: Adds metadata to route handlers/classes.
 */
import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_ROUTE_METADATA } from '../constants/metadata.constants';

export function PublicRoute() {
  return SetMetadata(IS_PUBLIC_ROUTE_METADATA, true);
}
