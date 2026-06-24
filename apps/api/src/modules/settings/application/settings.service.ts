/**
 * Purpose: Per-RT settings use cases — public finance (kas) visibility + access token.
 * Caller: SettingsController (dashboard) and ReportsService (public gate).
 * Deps: SETTINGS_REPOSITORY port, AuthPrincipal, node crypto.
 * MainFuncs: Reads/sets finance visibility, generating an unguessable token when switching to TOKEN.
 * SideEffects: Persists settings + audit via the repository.
 */
import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SETTINGS_REPOSITORY } from '../settings.tokens';
import type { SettingsRepositoryPort } from '../infrastructure/settings.repository.port';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { FinanceVisibility, FinanceVisibilityMode } from '../domain/settings.types';

@Injectable()
export class SettingsService {
  constructor(@Inject(SETTINGS_REPOSITORY) private readonly repository: SettingsRepositoryPort) {}

  getFinanceVisibility(actor: AuthPrincipal): Promise<FinanceVisibility> {
    return this.repository.getFinanceVisibility(actor.rtId);
  }

  getFinanceVisibilityByRtCode(rtCode: string): Promise<FinanceVisibility | null> {
    return this.repository.getFinanceVisibilityByRtCode(rtCode);
  }

  async setFinanceVisibility(actor: AuthPrincipal, mode: FinanceVisibilityMode): Promise<FinanceVisibility> {
    const current = await this.repository.getFinanceVisibility(actor.rtId);
    let token = current.token;
    if (mode === 'PUBLIC') {
      token = null;
    } else if (!token) {
      token = this.generateToken();
    }
    return this.repository.setFinanceVisibility(actor.rtId, { mode, token }, actor.userId);
  }

  async regenerateToken(actor: AuthPrincipal): Promise<FinanceVisibility> {
    const current = await this.repository.getFinanceVisibility(actor.rtId);
    return this.repository.setFinanceVisibility(actor.rtId, { mode: current.mode, token: this.generateToken() }, actor.userId);
  }

  private generateToken(): string {
    return randomBytes(12).toString('base64url');
  }
}
