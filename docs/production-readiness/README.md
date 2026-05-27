<!--
Purpose: Production-readiness checklist for the JIMPITAN VPS deployment foundation.
Caller: Release operators, maintainers, CI checks, and Codex agents before deployment changes.
Deps: docs/deployment/README.md, docs/testing/README.md, compose.prod.yaml, infrastructure/nginx/nginx.conf, scripts/readiness-check.mjs.
MainFuncs: Tracks readiness categories for env safety, auth, CORS, proxying, RBAC, tenant isolation, worker queues, backup, health, and logging.
SideEffects: None.
-->

# Production Readiness

## Security Checklist

- Env validation rejects placeholders and production-unsafe test variables.
- Production Compose requires public web/API URLs instead of falling back to localhost.
- Local volume storage does not require unused S3 credentials.
- Production npm audit triage is documented in `docs/security/audit.md`.
- Prisma CLI/client production advisory is patched by pinning `prisma` and `@prisma/client` together on `6.19.3`.
- Next/PostCSS advisory is temporarily accepted only under the documented no-user-CSS/no-raw-HTML mitigation.
- Auth cookies are httpOnly, secure in production, and documented behind HTTPS.
- Token storage avoids browser-accessible long-lived secrets.
- CORS is same-origin by default and HTTPS-only when cross-origin is required.
- Nginx forwards `X-Forwarded-*` headers and API trusts the documented proxy hop count.
- Rate-limit foundation exists for API and auth routes.
- Public report routes have private-field leak tests.
- RBAC tests cover unauthorized role access.
- Tenant isolation tests cover cross-tenant read/write rejection.

## Operations Checklist

- Health checks cover API live/ready, web health, Nginx health, PostgreSQL, Redis, and worker process behavior.
- Worker queue risks are documented for notification outbox, report exports, and Telegram delivery retries.
- PostgreSQL uses a named volume and backup/restore scripts are documented.
- Upload and export storage strategy is documented and shared between API and worker.
- Logging foundation emits structured enough process, request, and worker context for VPS troubleshooting.
- Docker Compose exposes only Nginx in production.
- Database migration command is documented.
- Deployment verification includes build, test, Prisma validate, import-cycle scan, infra check, smoke check, readiness check, and Docker config validation.
- GitHub Actions CI runs Prisma generation/validation, API/web tests, typecheck, builds, import-cycle scan, infra/readiness checks, Docker Compose config, and Playwright E2E with failure artifacts.
- Playwright E2E seeds an isolated test RT namespace and validates the MVP collection/finance/public-report journey against API and web runtimes.

## Launch Checklist

- Run `npm audit --omit=dev` and confirm only the documented Next/PostCSS temporary risk remains.
- Confirm `npm audit fix --force` was not used.
- Confirm no Next downgrade or canary upgrade was introduced.
- Confirm Prisma packages are pinned together on `6.19.3`.
- Confirm the launch-facing readiness summary in `docs/production-readiness.md` is current.
