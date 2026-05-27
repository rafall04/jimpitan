/**
 * Purpose: Validate JIMPITAN API environment variables before startup.
 * Caller: NestJS ConfigModule validate hook.
 * Deps: zod.
 * MainFuncs: Enforces required env names, production secret strength, optional storage settings, and safe defaults.
 * SideEffects: Throws on invalid runtime configuration.
 */
import { z } from 'zod';

const placeholderPattern = /(replace-with|change-me|example\.com)/i;

const envSchema = z
  .object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.string().default('local'),
  APP_NAME: z.string().default('JIMPITAN API'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('1'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  BOT_TOKEN: z.string().min(1),
  BOT_WEBHOOK_SECRET: z.string().min(1),
  BOT_WEBHOOK_URL: z.string().url(),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
  UPLOAD_STORAGE_PATH: z.string().min(1).default('/var/lib/jimpitan/uploads'),
  EXPORT_STORAGE_PATH: z.string().min(1).default('/var/lib/jimpitan/exports'),
  WORKER_QUEUES: z.string().default('notification-outbox,report-exports,telegram-delivery'),
  WORKER_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(20),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  WORKER_STALE_JOB_MS: z.coerce.number().int().min(60000).default(900000),
  WORKER_RUN_ONCE: z.enum(['true', 'false']).default('false'),
  WORKER_HEALTH_FILE: z.string().min(1).default('/tmp/jimpitan-worker-health'),
  SWAGGER_ENABLED: z.enum(['true', 'false']).default('true'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== 'production') {
      return;
    }

    for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'BOT_TOKEN', 'BOT_WEBHOOK_SECRET', 'BOT_WEBHOOK_URL'] as const) {
      if (placeholderPattern.test(env[key])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must not use placeholder values in production.`,
        });
      }
    }

    for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const) {
      if (env[key] && placeholderPattern.test(env[key])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must not use placeholder values in production when S3 storage is configured.`,
        });
      }
    }

    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[key].length < 32) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must be at least 32 characters in production.`,
        });
      }
    }

    if (env.BOT_WEBHOOK_SECRET.length < 16) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOT_WEBHOOK_SECRET'],
        message: 'BOT_WEBHOOK_SECRET must be at least 16 characters in production.',
      });
    }

    if (!env.BOT_WEBHOOK_URL.startsWith('https://')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BOT_WEBHOOK_URL'],
        message: 'BOT_WEBHOOK_URL must use HTTPS in production.',
      });
    }

    for (const origin of env.CORS_ALLOWED_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)) {
      if (!origin.startsWith('https://')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ALLOWED_ORIGINS'],
          message: 'CORS_ALLOWED_ORIGINS must use HTTPS origins in production.',
        });
      }
    }
  });

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  return envSchema.parse(config);
}
