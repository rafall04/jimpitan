/**
 * Purpose: HTTP controller boundary for future attachment endpoints.
 * Caller: NestJS router.
 * Deps: AttachmentsService.
 * MainFuncs: Reserves attachment route ownership.
 * SideEffects: None.
 */
import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('attachments')
@Controller({ path: 'attachments', version: '1' })
export class AttachmentsController {}
