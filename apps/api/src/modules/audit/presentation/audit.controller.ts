/**
 * Purpose: HTTP controller boundary for future audit endpoints.
 * Caller: NestJS router.
 * Deps: AuditService.
 * MainFuncs: Reserves audit route ownership.
 * SideEffects: None.
 */
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('audit')
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {}
