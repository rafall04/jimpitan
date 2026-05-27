<!--
Purpose: Local Playwright E2E runbook for the JIMPITAN MVP journey suite.
Caller: Developers, CI maintainers, and release operators running browser E2E checks.
Deps: playwright.config.ts, env.e2e.example, tests/e2e, scripts/e2e-check.mjs, PostgreSQL test database.
MainFuncs: Documents safe test database setup, seeded fixtures, runtime commands, and failure artifacts.
SideEffects: None.
-->

# E2E Testing

Use a disposable PostgreSQL database only. Copy `env.e2e.example` to `.env.e2e`, adjust the database URL if needed, then run:

```bash
npm run test:e2e
```

The runner loads `.env.e2e`, pushes `prisma/schema.prisma` to the E2E database, seeds one isolated RT namespace, starts API and web, runs Playwright, and cleans the namespace during teardown.

Seeded users share the example password:

- `super-admin.e2e@e2e.local`
- `ketua.e2e@e2e.local`
- `bendahara.e2e@e2e.local`
- `petugas.e2e@e2e.local`

Failure artifacts are written under `test-results` and the HTML report under `playwright-report`.
