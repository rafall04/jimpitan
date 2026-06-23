/**
 * Purpose: Marks controllers/handlers that intentionally bypass the global TenantGuard (cross-tenant administration).
 * Caller: TenantsController and any future cross-tenant administrative route.
 * Deps: NestJS metadata API and metadata constants.
 * MainFuncs: Stores skip-tenant metadata read by the global TenantGuard.
 * SideEffects: Adds metadata to route handlers/classes.
 */
import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_GUARD_METADATA } from '../constants/metadata.constants';

export function SkipTenantGuard() {
  return SetMetadata(SKIP_TENANT_GUARD_METADATA, true);
}
