/**
 * Purpose: Playwright runtime configuration for JIMPITAN E2E tests.
 * Caller: npm run test:e2e and GitHub Actions CI.
 * Deps: @playwright/test, built API/web apps, E2E env variables, and global setup/teardown.
 * MainFuncs: Starts API and web servers, configures browser artifacts, and scopes E2E specs.
 * SideEffects: Builds and starts local API/web processes during E2E runs.
 */
import { defineConfig, devices } from '@playwright/test';

const webBaseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3101/api/v1';
const apiPort = new URL(apiBaseUrl).port || '3101';
const webPort = new URL(webBaseUrl).port || '3100';
const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

const e2eApiEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'e2e',
  API_PORT: apiPort,
  API_PREFIX: 'api',
  API_VERSION: '1',
  DATABASE_URL: databaseUrl,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
  TRUST_PROXY_HOPS: '0',
  CORS_ALLOWED_ORIGINS: '',
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-minimum-32-chars',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-minimum-32-chars',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_TTL_SECONDS: '2592000',
  BCRYPT_ROUNDS: process.env.E2E_BCRYPT_ROUNDS ?? '10',
  BOT_TOKEN: process.env.BOT_TOKEN ?? 'e2e-telegram-bot-token',
  BOT_WEBHOOK_SECRET: process.env.BOT_WEBHOOK_SECRET ?? 'e2e-telegram-secret',
  BOT_WEBHOOK_URL: `${apiBaseUrl}/telegram/webhook`,
  S3_ENDPOINT: '',
  S3_REGION: '',
  S3_BUCKET: '',
  S3_ACCESS_KEY: '',
  S3_SECRET_KEY: '',
  S3_FORCE_PATH_STYLE: 'true',
  UPLOAD_STORAGE_PATH: process.env.E2E_UPLOAD_STORAGE_PATH ?? 'tmp/e2e/uploads',
  EXPORT_STORAGE_PATH: process.env.E2E_EXPORT_STORAGE_PATH ?? 'tmp/e2e/exports',
  WORKER_QUEUES: 'notification-outbox,report-exports,telegram-delivery',
  WORKER_BATCH_SIZE: '20',
  WORKER_POLL_INTERVAL_MS: '5000',
  WORKER_STALE_JOB_MS: '900000',
  WORKER_RUN_ONCE: 'false',
  WORKER_HEALTH_FILE: 'tmp/e2e/worker-health',
  SWAGGER_ENABLED: 'false',
};

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/support/global-setup.ts',
  globalTeardown: './tests/e2e/support/global-teardown.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']] : [['list']],
  use: {
    baseURL: webBaseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run build:api && npm run start:api:e2e',
      url: `${apiBaseUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: e2eApiEnv,
    },
    {
      command: 'npm run build:web && npm run start:web:e2e',
      url: `${webBaseUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
        NEXT_PUBLIC_APP_URL: webBaseUrl,
        PORT: webPort,
      },
    },
  ],
});
