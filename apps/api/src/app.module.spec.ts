/**
 * Purpose: Runtime DI regression test for the root API module.
 * Caller: Vitest API test suite.
 * Deps: Nest testing module, AppModule, and safe test environment variables.
 * MainFuncs: Compiles the real AppModule so provider token regressions fail before production runtime.
 * SideEffects: Reads and temporarily mutates process.env during the test.
 */
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/application/auth.service';

const envState = vi.hoisted(() => {
  const originalEnv = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATABASE_URL: 'postgresql://jimpitan:test-password@localhost:5432/jimpitan_test?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test-access-secret-min-32-characters',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-characters',
    BOT_TOKEN: 'test-telegram-token',
    BOT_WEBHOOK_SECRET: 'test-telegram-webhook-secret',
    BOT_WEBHOOK_URL: 'https://rt.test/api/v1/telegram/webhook',
  });
  return { originalEnv };
});

describe('AppModule dependency injection', () => {
  afterAll(() => {
    process.env = { ...envState.originalEnv };
  });

  it('compiles the real AppModule without unresolved providers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    expect(moduleRef.get(AuthService, { strict: false })).toBeInstanceOf(AuthService);
    await moduleRef.close();
  }, 15000);

  it('uses an explicit DI token for AuthService function dependencies', () => {
    const source = readFileSync('apps/api/src/modules/auth/application/auth.service.ts', 'utf8');

    expect(source).toContain('@Inject(AUTH_SESSION_ID_FACTORY) private readonly sessionIdFactory');
  });

  it('registers the authentication, tenant, and permission guards globally (auth is fail-closed)', () => {
    const source = readFileSync('apps/api/src/app.module.ts', 'utf8');

    expect(source).toContain('provide: APP_GUARD, useClass: AuthenticationGuard');
    expect(source).toContain('provide: APP_GUARD, useClass: TenantGuard');
    expect(source).toContain('provide: APP_GUARD, useClass: PermissionGuard');
  });
});
