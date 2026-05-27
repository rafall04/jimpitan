<!--
Purpose: Testing runbook for E2E, smoke, and readiness verification.
Caller: Developers, CI maintainers, and release operators.
Deps: package.json, tests/.module_map.md, docs/testing/e2e.md, scripts/e2e-check.mjs, scripts/smoke-check.mjs, scripts/readiness-check.mjs.
MainFuncs: Documents local E2E env expectations, deterministic fixtures, cleanup, Playwright runtime, and CI-ready command targets.
SideEffects: None.
-->

# Testing

## E2E Foundation

The E2E suite is designed for a disposable test database and non-production HTTP targets only. It must not use production secrets or point at production hosts.

Required safe variables:

- `E2E_BASE_URL`
- `E2E_API_BASE_URL`
- `E2E_DATABASE_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Optional variable:

- `E2E_TELEGRAM_SECRET_TOKEN`

Fixture strategy:

- Generate a deterministic `runId` for each run.
- Seed one tenant/RT, admin, officer, approval policy, area, house, resident, cash account, and public report fixture.
- Tag all test-created records with the run id where the schema supports it, or store external cleanup handles.
- Clean up records after each run, including failed runs.

## Commands

```bash
npm run test:e2e
npm run test:smoke
npm run readiness:check
```

`npm run test:e2e` runs Playwright when `E2E_DATABASE_URL` is present, starts API/web automatically, and writes failure artifacts. See `docs/testing/e2e.md`.

`npm run test:smoke` skips runtime HTTP checks unless `SMOKE_WEB_URL` and `SMOKE_API_URL` are present.

Docker validation is required before production deployment. If Docker CLI is unavailable on the development machine, run the Compose config validation manually on the target host:

```bash
docker compose -f compose.prod.yaml --env-file .env.production config
```
