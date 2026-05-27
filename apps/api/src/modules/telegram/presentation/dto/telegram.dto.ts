/**
 * Purpose: DTOs for Telegram binding-code and outbox processing REST endpoints.
 * Caller: TelegramController and Swagger/OpenAPI generation.
 * Deps: class-validator, class-transformer, and Swagger decorators.
 * MainFuncs: Validates binding-code target inputs and worker drain limits.
 * SideEffects: None.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { CreateTelegramBindCodeCommand, ProcessTelegramOutboxCommand } from '../../application/telegram.commands';

export class CreateTelegramBindCodeDto implements CreateTelegramBindCodeCommand {
  @ApiPropertyOptional({ description: 'Target active same-tenant user ID. Defaults to current user.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Target active same-tenant membership ID. Defaults to current membership.' })
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @ApiPropertyOptional({ description: 'Optional active same-tenant resident ID to link.' })
  @IsOptional()
  @IsUUID()
  residentId?: string;

  @ApiPropertyOptional({ description: 'Bind code expiry window in minutes.', minimum: 5, maximum: 1440, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  expiresInMinutes?: number;
}

export class ProcessTelegramOutboxDto implements ProcessTelegramOutboxCommand {
  @ApiPropertyOptional({ description: 'Maximum Telegram outbox events to claim.', minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
