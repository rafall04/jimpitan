/**
 * Purpose: Map validated environment variables into structured API configuration.
 * Caller: NestJS ConfigModule load pipeline.
 * Deps: process.env populated by runtime environment.
 * MainFuncs: Groups API, database, Redis, auth, JWT, Telegram, storage, security, worker, logging, and Swagger settings.
 * SideEffects: None.
 */
export const configuration = () => ({
  app: {
    env: process.env.APP_ENV ?? 'local',
    name: process.env.APP_NAME ?? 'JIMPITAN API',
  },
  api: {
    port: Number(process.env.API_PORT ?? 3001),
    prefix: process.env.API_PREFIX ?? 'api',
    version: process.env.API_VERSION ?? '1',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  security: {
    corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxyHops: Number(process.env.TRUST_PROXY_HOPS ?? 0),
  },
  auth: {
    passwordHashRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000),
  },
  telegram: {
    botToken: process.env.BOT_TOKEN,
    webhookSecret: process.env.BOT_WEBHOOK_SECRET,
    webhookUrl: process.env.BOT_WEBHOOK_URL,
  },
  storage: {
    uploadPath: process.env.UPLOAD_STORAGE_PATH ?? '/var/lib/jimpitan/uploads',
    exportPath: process.env.EXPORT_STORAGE_PATH ?? '/var/lib/jimpitan/exports',
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  worker: {
    queues: (process.env.WORKER_QUEUES ?? 'notification-outbox,report-exports,telegram-delivery')
      .split(',')
      .map((queue) => queue.trim())
      .filter(Boolean),
    batchSize: Number(process.env.WORKER_BATCH_SIZE ?? 20),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
    staleJobMs: Number(process.env.WORKER_STALE_JOB_MS ?? 900000),
    runOnce: process.env.WORKER_RUN_ONCE === 'true',
    healthFile: process.env.WORKER_HEALTH_FILE ?? '/tmp/jimpitan-worker-health',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
  },
});
