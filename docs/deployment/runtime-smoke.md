<!--
Purpose: Runtime smoke-check runbook for deployed JIMPITAN environments.
Caller: Release operators and CI jobs validating a running API/web deployment.
Deps: scripts/smoke-check.mjs, API health endpoints, web health endpoint, and public report pages.
MainFuncs: Documents smoke env variables, protected-route rejection checks, and Docker validation fallback.
SideEffects: None.
-->

# Runtime Smoke Checks

Run against a deployed or locally running environment:

```bash
SMOKE_API_URL=https://rt.example.com/api/v1 SMOKE_WEB_URL=https://rt.example.com SMOKE_PUBLIC_RT_CODE=rt-demo npm run test:smoke
```

Checks:

- API health endpoint.
- API readiness endpoint.
- Web health endpoint.
- Public reports page when `SMOKE_PUBLIC_RT_CODE` is set.
- Protected API endpoint rejects unauthenticated access.

If Docker CLI is unavailable locally, run Compose validation manually on the target host:

```bash
docker compose -f compose.prod.yaml --env-file .env.production config
```

For an existing VPS using host Nginx and the staging override:

```bash
docker compose -f compose.prod.yaml -f compose.staging.yaml --env-file .env.production config
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS http://127.0.0.1:3101/api/v1/health/ready
curl -fsS -H 'Host: rt.example.com' http://127.0.0.1/api/health
curl -fsS -H 'Host: rt.example.com' http://127.0.0.1/api/v1/health/ready
SMOKE_API_URL=https://rt.example.com/api/v1 SMOKE_WEB_URL=https://rt.example.com npm run test:smoke
```
