/**
 * Purpose: Unit tests for production environment safety validation.
 * Caller: Vitest test runner.
 * Deps: validateEnvironment.
 * MainFuncs: Verifies production rejects placeholder secrets, weak secrets, and unsafe CORS origins.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation';

const baseEnv = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://jimpitan:private-db-password@postgres:5432/jimpitan?schema=public',
  REDIS_URL: 'redis://redis:6379',
  JWT_ACCESS_SECRET: 'private-access-secret-min-32-chars',
  JWT_REFRESH_SECRET: 'private-refresh-secret-min-32-chars',
  BOT_TOKEN: 'private-telegram-token',
  BOT_WEBHOOK_SECRET: 'private-telegram-webhook-secret',
  BOT_WEBHOOK_URL: 'https://rt.test/api/v1/telegram/webhook',
  S3_ENDPOINT: '',
  S3_REGION: '',
  S3_BUCKET: '',
  S3_ACCESS_KEY: '',
  S3_SECRET_KEY: '',
};

describe('validateEnvironment', () => {
  it('rejects placeholder secrets in production', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnv,
        JWT_ACCESS_SECRET: 'replace-with-private-access-secret-min-32',
      }),
    ).toThrow(/placeholder/i);
  });

  it('rejects insecure production CORS origins', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnv,
        CORS_ALLOWED_ORIGINS: 'http://example.com',
      }),
    ).toThrow(/https/i);
  });

  it('rejects weak production JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...baseEnv,
        JWT_REFRESH_SECRET: 'short-refresh-secret',
      }),
    ).toThrow(/32 characters/i);
  });

  it('allows local volume storage without S3 credentials', () => {
    expect(validateEnvironment(baseEnv).S3_ACCESS_KEY).toBe('');
  });
});
