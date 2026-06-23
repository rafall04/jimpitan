/**
 * Purpose: HTTP controller for Telegram webhook ingestion, binding-code creation, and outbox worker drains.
 * Caller: NestJS router and Telegram webhook configuration.
 * Deps: TelegramService, Auth/RBAC guards, Swagger decorators, and request context type.
 * MainFuncs: Exposes public webhook plus protected binding-code and delivery worker endpoints.
 * SideEffects: Writes Telegram update, binding, session, notification delivery, and audit data through TelegramService.
 */
import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import { PublicRoute } from '../../../common/decorators/public-route.decorator';import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { TelegramService } from '../application/telegram.service';
import { CreateTelegramBindCodeDto, ProcessTelegramOutboxDto } from './dto/telegram.dto';

@ApiTags('telegram')
@Controller({ path: 'telegram', version: '1' })
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @PublicRoute()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive Telegram webhook updates idempotently' })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @Post('webhook')
  async webhook(
    @Body() payload: unknown,
    @Headers('x-telegram-bot-api-secret-token') webhookSecret: string | undefined,
    @Req() request: RequestWithContext,
  ) {
    return this.telegramService.handleWebhook(payload, { ...this.requestMeta(request), webhookSecret });
  }

  @ApiBearerAuth()  @RequireAnyPermission('telegram.bind', 'telegram.manage')
  @ApiOperation({ summary: 'Create a one-time Telegram binding code for an active same-tenant target' })
  @Post('bind-codes')
  async createBindCode(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateTelegramBindCodeDto, @Req() request: RequestWithContext) {
    return this.telegramService.createBindingCode(principal, dto, this.requestMeta(request));
  }

  @ApiBearerAuth()  @RequireAnyPermission('telegram.manage', 'notifications.manage')
  @ApiOperation({ summary: 'Drain pending Telegram notification outbox events' })
  @Post('outbox/drain')
  async drainOutbox(@Body() dto: ProcessTelegramOutboxDto) {
    return this.telegramService.processTelegramOutbox(dto);
  }

  private requestMeta(request: RequestWithContext) {
    return {
      correlationId: request.correlationId,
      userAgent: this.headerValue(request.headers['user-agent']),
      ipAddress: request.ip && isIP(request.ip) ? request.ip : undefined,
    };
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
