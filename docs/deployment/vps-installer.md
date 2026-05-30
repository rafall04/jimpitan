<!--
Purpose: Operator runbook for the safe semi-automatic JIMPITAN VPS installer and rollback helper.
Caller: VPS operators using scripts/install-vps.sh or scripts/rollback-vps.sh.
Deps: scripts/install-vps.sh, scripts/rollback-vps.sh, scripts/run-prisma-schema-command.mjs, prisma/schema.prisma, apps/api/Dockerfile, apps/api/Dockerfile.worker, compose.prod.yaml, generated compose.vps-nginx.yaml, .env.production, host Nginx, Docker Compose, docs/deployment/first-admin-bootstrap.md.
MainFuncs: Documents installer modes, safety boundaries, prompts, generated files, Prisma runtime target checks, first-admin bootstrap handoff, smoke checks, update flow, SSL handling, and rollback.
SideEffects: None.
-->

# VPS Installer

Use `scripts/install-vps.sh` when the VPS already runs host Nginx for other apps. The installer keeps Docker off public ports `80` and `443`, binds JIMPITAN web/API only to loopback ports `3100` and `3101`, and leaves PostgreSQL and Redis private inside Docker.

## Safety Boundaries

- Existing `nginx.service` is not stopped.
- Nginx is only reloaded after `nginx -t` passes and the operator confirms.
- Existing `/etc/nginx/sites-available/jimpitan.conf` is backed up before overwrite and requires confirmation.
- Unrelated Nginx configs are not modified.
- Docker does not publish JIMPITAN PostgreSQL or Redis ports.
- Docker volumes are not deleted.
- `docker system prune` is not used.

## Install

Run as root from the repository root:

```bash
sudo ./scripts/install-vps.sh
```

The installer asks for:

- Domain name, such as `rt.example.com`.
- Public app URL, such as `https://rt.example.com`.
- Public API URL, such as `https://rt.example.com/api/v1`.
- Whether to enable SSL with certbot.
- Admin email when SSL is enabled.

It writes an action log to `install-jimpitan.log`.

## Modes

Dry run:

```bash
sudo ./scripts/install-vps.sh --dry-run
```

No SSL:

```bash
sudo ./scripts/install-vps.sh --no-ssl
```

Update:

```bash
sudo ./scripts/install-vps.sh --update
```

Update mode runs `git pull`, validates Compose, rebuilds and restarts containers, runs migrations, and checks health. It does not recreate the JIMPITAN Nginx config unless the config is missing.

## Generated Files

If missing, the installer creates `.env.production` from `.env.example` or `env.example`, then fills required runtime values without printing secrets. It generates strong values for `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_WEBHOOK_SECRET`, and `POSTGRES_PASSWORD` when values are missing or placeholder-like.

If missing, the installer creates `compose.vps-nginx.yaml` with:

- `web` bound to `127.0.0.1:3100`.
- `api` bound to `127.0.0.1:3101`.
- Docker `nginx` disabled behind an inactive profile.
- PostgreSQL and Redis left without host ports.

## Checks

The installer validates:

- Required commands: `docker`, `docker compose`, `git`, `curl`, `openssl`, and `nginx`.
- Ports `3100` and `3101` are free on a fresh install.
- Existing listeners on `80` and `443` are reported but not changed.
- API and worker Docker build stages include `scripts/run-prisma-schema-command.mjs` and `prisma/schema.prisma` before Prisma client generation.
- Prisma Client is generated with `native` and `debian-openssl-3.0.x`, and runtime images copy generated Prisma client engine files from the build stage for `node:20-bookworm-slim`.
- Docker Compose config is valid.
- Containers `api`, `web`, `worker`, `postgres`, and `redis` become healthy.
- Internal endpoints respond:

```bash
curl -fsS http://127.0.0.1:3101/api/v1/health
curl -fsS http://127.0.0.1:3100
```

After confirmed Nginx reload, it checks:

```bash
curl -fsS http://DOMAIN
curl -fsS http://DOMAIN/api/v1/health
```

When SSL is enabled, HTTPS versions are checked too.

After install or update, create the first login user with `npm run bootstrap:admin` inside the API container. See `docs/deployment/first-admin-bootstrap.md`; the installer does not ask for or print the admin password.

## Rollback

Use the helper:

```bash
sudo ./scripts/rollback-vps.sh
```

Or run the manual sequence:

```bash
APP_ENV_FILE=.env.production docker compose -f compose.prod.yaml -f compose.vps-nginx.yaml --env-file .env.production down
cp /etc/nginx/sites-available/jimpitan.conf.bak.YYYYMMDDTHHMMSSZ /etc/nginx/sites-available/jimpitan.conf
nginx -t
systemctl reload nginx
```

The rollback helper does not delete Docker volumes.
