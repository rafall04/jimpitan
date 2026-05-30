<!--
Purpose: VPS-friendly deployment runbook for the JIMPITAN production infrastructure foundation.
Caller: Operators and maintainers preparing Docker Compose deployments.
Deps: compose.prod.yaml, compose.staging.yaml, compose.dev.yaml, env.example, prisma/schema.prisma, apps/api/Dockerfile, apps/api/Dockerfile.worker, infrastructure/nginx/nginx.conf, scripts/run-prisma-schema-command.mjs, scripts/backup-postgres.sh, scripts/restore-postgres.sh, scripts/deployment-verify.mjs, docs/deployment/first-admin-bootstrap.md, docs/testing/README.md, docs/deployment/runtime-smoke.md, docs/production-readiness/README.md.
MainFuncs: Documents environment handling, service topology, Prisma runtime targets, first-admin bootstrap, migration, health checks, worker queues, storage, security, readiness, testing, and backup/restore commands.
SideEffects: None.
-->

# Deployment

## Topology

Production runs `nginx`, `web`, `api`, `worker`, `postgres`, and `redis` on one Docker network. Only Nginx publishes a host port; API, web, PostgreSQL, and Redis stay internal. The worker drains durable PostgreSQL job tables for report exports and notification/Telegram delivery.

For an existing VPS that already has host Nginx and other Node.js apps, use `compose.staging.yaml` on top of `compose.prod.yaml`. In that layout Docker Nginx is disabled by profile, JIMPITAN web is bound to `127.0.0.1:3100`, JIMPITAN API is bound to `127.0.0.1:3101`, and PostgreSQL/Redis remain private on the Docker network. This avoids conflicts with existing host services on ports such as `3010`, `3200`, and `800`.

## Environment

Copy `env.example` to a private `.env.production` file and replace every `replace-with-private-*` value:

```bash
cp env.example .env.production
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml --env-file .env.production config
npm run infra:check
```

Do not commit real `.env` files. Production containers reject placeholder secrets, weak JWT secrets, weak Telegram webhook secrets, and non-HTTPS CORS origins at startup. `APP_ENV_FILE` must point to the private env file; production Compose also requires `POSTGRES_PASSWORD`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_APP_URL` during config interpolation. `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_APP_URL` must use the public origin served by Nginx, for example `https://rt.example.com/api/v1` and `https://rt.example.com`.

## Commands

Build and start production:

```bash
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml --env-file .env.production up -d --build
```

API and worker Docker builds copy only the Prisma command wrapper from `scripts/run-prisma-schema-command.mjs` into the build stage before `npm run prisma:generate`; `.env` files and `node_modules` are not copied into the image build context by those Dockerfile instructions. The Prisma schema generates both `native` and `debian-openssl-3.0.x` clients so locally generated clients and `node:20-bookworm-slim` production images have the required query engine. Runtime images copy `node_modules/.prisma` and `node_modules/@prisma` from the build stage.

Build and start on an existing VPS with host Nginx:

```bash
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml -f compose.staging.yaml --env-file .env.production up -d --build postgres redis api worker web
```

Run database migrations:

```bash
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml --env-file .env.production run --rm api npm run migrate:deploy
```

Production deployments apply committed Prisma migrations with `prisma migrate deploy` for production and VPS updates.

Bootstrap the first tenant and admin user after migrations with `npm run bootstrap:admin` inside the API container. The full runbook is `docs/deployment/first-admin-bootstrap.md`.

For the host-Nginx staging layout, include the override when running one-off commands:

```bash
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml -f compose.staging.yaml --env-file .env.production run --rm api npm run migrate:deploy
```

Check health:

```bash
docker compose -f compose.prod.yaml ps
curl -fsS http://127.0.0.1/nginx-health
curl -fsS http://127.0.0.1/api/v1/health/ready
```

Check health for the host-Nginx staging layout:

```bash
docker compose -f compose.prod.yaml -f compose.staging.yaml --env-file .env.production ps
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS http://127.0.0.1:3101/api/v1/health/ready
```

Run deployment verification:

```bash
npm run deploy:verify
npm run readiness:check
npm run test:smoke
```

Runtime smoke variables and Docker CLI fallback steps are documented in `docs/deployment/runtime-smoke.md`.

## Existing VPS With Host Nginx

Use this layout when the VPS already has Nginx listening on public ports `80` and `443`, and existing applications already occupy ports such as `3010`, `3200`, and `800`. Do not start the Docker `nginx` service in this layout; the Compose override assigns it to a disabled profile and clears its host ports.

Expected private/public boundary:

- Host Nginx listens publicly on `80`/`443`.
- JIMPITAN web listens only on `127.0.0.1:3100`.
- JIMPITAN API listens only on `127.0.0.1:3101`.
- PostgreSQL and Redis publish no host ports.
- Existing apps on `3010`, `3200`, and `800` are untouched.

Before starting, check for conflicts:

```bash
ss -ltnp | grep -E ':3010|:3100|:3101|:3200|:800|:80|:443'
docker compose -f compose.prod.yaml -f compose.staging.yaml --env-file .env.production config
```

Set the public URLs in `.env.production` to the host-Nginx public origin:

```bash
NEXT_PUBLIC_APP_URL=https://rt.example.com
NEXT_PUBLIC_API_BASE_URL=https://rt.example.com/api/v1
CORS_ALLOWED_ORIGINS=
TRUST_PROXY_HOPS=1
JIMPITAN_WEB_HOST_PORT=3100
JIMPITAN_API_HOST_PORT=3101
```

Add this map once in the host Nginx `http` context if it does not already exist:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

Host Nginx server block for a dedicated JIMPITAN subdomain:

```nginx
server {
    listen 80;
    server_name rt.example.com;

    client_max_body_size 20m;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:3101/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-Id $request_id;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
    }
}
```

If you must add JIMPITAN to an existing Nginx file, create a new `server_name` for JIMPITAN instead of adding `location /` to a server block that already serves another app. The current Next.js build is root-mounted; subpath mounting such as `/rt/` requires a separate `basePath` change and is not part of this VPS layout.

Shared TLS listener example using the same public `listen 443 ssl` style as other apps:

```nginx
server {
    listen 443 ssl;
    server_name rt.example.com;

    ssl_certificate /etc/letsencrypt/live/rt.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rt.example.com/privkey.pem;

    client_max_body_size 20m;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:3101/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-Id $request_id;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Request-Id $request_id;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Validate and reload host Nginx without affecting existing apps:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Smoke test through localhost and host Nginx:

```bash
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS http://127.0.0.1:3101/api/v1/health/ready
curl -fsS -H 'Host: rt.example.com' http://127.0.0.1/api/health
curl -fsS -H 'Host: rt.example.com' http://127.0.0.1/api/v1/health/ready
SMOKE_API_URL=https://rt.example.com/api/v1 SMOKE_WEB_URL=https://rt.example.com npm run test:smoke
```

## Worker

`worker` uses `WORKER_QUEUES=notification-outbox,report-exports,telegram-delivery`. `notification-outbox` and `telegram-delivery` drain the same Telegram notification outbox through one pass, so enabling both is safe. `report-exports` claims queued CSV exports by `(status, format, createdAt)` and processes them with requested-user audit context. `WORKER_STALE_JOB_MS` defaults to 15 minutes and returns stale `PROCESSING` export/outbox rows to a retryable state before each polling pass.

## Storage

PostgreSQL uses the `postgres_data` named volume. Redis uses `redis_data`. API and worker share `upload_data` at `/var/lib/jimpitan/uploads` and `export_data` at `/var/lib/jimpitan/exports`. S3-compatible variables are optional and remain documented for future object storage integration; leave them blank for the current local-volume VPS strategy.

## Security

Nginx adds security headers, forwards `X-Forwarded-*` and `X-Request-Id` headers, supports connection upgrades, enforces `client_max_body_size 20m`, and defines basic per-IP API/auth rate limits. Set `TRUST_PROXY_HOPS=1` when API is behind Nginx. Keep `CORS_ALLOWED_ORIGINS` empty for same-origin Nginx deployments; set it to comma-separated HTTPS origins only when a browser must call API cross-origin. Terminate TLS either in this Nginx container with a future certificate mount or at a VPS edge proxy; configure HSTS only on the HTTPS terminator.

Next.js auth cookies are httpOnly and become `secure` when `NODE_ENV=production`, so production must be served through HTTPS at the external proxy/load balancer layer. Keep `sameSite=lax` unless the app is intentionally embedded cross-site.

## Backup And Restore

Backup:

```bash
ENV_FILE=.env.production COMPOSE_FILE=compose.prod.yaml sh scripts/backup-postgres.sh
```

Backups are compressed PostgreSQL custom-format dumps, default to `backups/postgres`, and prune local backups older than `RETENTION_DAYS` with a default of 14 days. Copy backups off the VPS and encrypt them using your operations standard.

Restore:

```bash
ALLOW_DESTRUCTIVE_RESTORE=yes ENV_FILE=.env.production COMPOSE_FILE=compose.prod.yaml sh scripts/restore-postgres.sh backups/postgres/jimpitan-jimpitan-YYYYMMDDTHHMMSSZ.dump.gz
```

Restore writes into the configured database and uses `--clean --if-exists` for custom dump files; take a fresh backup before running it.
