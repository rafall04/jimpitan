/**
 * Purpose: HTTP controller boundary for future RBAC endpoints.
 * Caller: NestJS router.
 * Deps: RbacService.
 * MainFuncs: Reserves roles and permissions route ownership.
 * SideEffects: None.
 */
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('rbac')
@Controller({ path: 'rbac', version: '1' })
export class RbacController {}
