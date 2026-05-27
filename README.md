<!--
Purpose: Root README for the JIMPITAN workspace.
Caller: Developers, operators, and Codex agents orienting in the repository.
Deps: SYSTEM_MAP.md, package.json, docs/deployment/README.md, docs/testing/README.md, docs/testing/e2e.md, docs/deployment/runtime-smoke.md, docs/production-readiness/README.md.
MainFuncs: Points to workspace maps, local commands, testing, readiness, and deployment documentation.
SideEffects: None.
-->

# JIMPITAN

Read `SYSTEM_MAP.md` first for the current backend, frontend, database, and infrastructure map.

## Development

```bash
npm install
npm run prisma:generate
npm run build:api
npm run build:web
npm run test:api
npm run test:web
```

## Testing And Readiness

E2E, smoke, and production-readiness foundations are documented in `docs/testing/README.md` and `docs/production-readiness/README.md`.
Playwright E2E setup is documented in `docs/testing/e2e.md`; runtime deployment smoke checks are documented in `docs/deployment/runtime-smoke.md`.

```bash
npm run test:e2e
npm run test:smoke
npm run readiness:check
```

## Deployment

VPS-friendly Docker Compose deployment is documented in `docs/deployment/README.md`.

Production services:

- `nginx`: only public service; reverse proxies web and API.
- `web`: Next.js standalone frontend.
- `api`: NestJS API.
- `worker`: background report export and notification/Telegram outbox worker.
- `postgres`: primary database with named volume.
- `redis`: shared infrastructure service for cache/rate-limit/future queue adapters.

Validate production Compose with:

```bash
npm run infra:check
npm run docker:config:prod
```
