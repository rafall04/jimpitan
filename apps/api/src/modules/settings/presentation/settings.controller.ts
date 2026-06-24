/**
 * Purpose: HTTP controller for tenant-scoped settings (public finance visibility).
 * Caller: NestJS router (authenticated dashboard routes).
 * Deps: SettingsService, Auth/RBAC decorators, finance visibility DTO.
 * MainFuncs: Reads, sets, and regenerates the per-RT kas visibility + token.
 * SideEffects: Persists settings through SettingsService.
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { SettingsService } from '../application/settings.service';
import { FinanceVisibilityDto } from './dto/finance-visibility.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequireAnyPermission('settings.read')
  @ApiOperation({ summary: 'Get public finance (kas) visibility for the active RT' })
  @Get('finance-visibility')
  getFinanceVisibility(@CurrentUser() principal: AuthPrincipal) {
    return this.settingsService.getFinanceVisibility(principal);
  }

  @RequireAnyPermission('settings.update')
  @ApiOperation({ summary: 'Set public finance (kas) visibility (PUBLIC or TOKEN)' })
  @Put('finance-visibility')
  setFinanceVisibility(@CurrentUser() principal: AuthPrincipal, @Body() dto: FinanceVisibilityDto) {
    return this.settingsService.setFinanceVisibility(principal, dto.mode);
  }

  @RequireAnyPermission('settings.update')
  @ApiOperation({ summary: 'Regenerate the kas access token' })
  @Post('finance-visibility/regenerate-token')
  regenerateToken(@CurrentUser() principal: AuthPrincipal) {
    return this.settingsService.regenerateToken(principal);
  }
}
