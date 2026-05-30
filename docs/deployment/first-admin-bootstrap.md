<!--
Purpose: First-admin bootstrap runbook for production JIMPITAN deployments.
Caller: Operators after deploying API containers and running migrations.
Deps: npm run bootstrap:admin, apps/api/src/bootstrap/admin.ts, Docker Compose, .env.production, and prisma/schema.prisma.
MainFuncs: Documents required inputs, safe execution, force behavior, created records, and verification steps.
SideEffects: None.
-->

# First Admin Bootstrap

Run this once after production containers are built and migrations have run. The command must run inside the API container so it uses the production image, production environment, Prisma Client, and the same bcrypt password hasher as the login flow.

Preferred invocation keeps the password out of the command line:

```bash
docker compose -f compose.prod.yaml --env-file .env.production exec \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='use-a-strong-private-password' \
  -e ADMIN_NAME='Initial Admin' \
  -e TENANT_NAME='RT 001' \
  -e TENANT_SLUG='rt001' \
  api npm run bootstrap:admin
```

Existing host-Nginx VPS deployments use the generated override:

```bash
docker compose -f compose.prod.yaml -f compose.vps-nginx.yaml --env-file .env.production exec \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD='use-a-strong-private-password' \
  -e ADMIN_NAME='Initial Admin' \
  -e TENANT_NAME='RT 001' \
  -e TENANT_SLUG='rt001' \
  api npm run bootstrap:admin
```

The command creates only operational bootstrap records:

- One RT tenant using `TENANT_NAME` and normalized `TENANT_SLUG`.
- One active admin user using `ADMIN_EMAIL`, `ADMIN_NAME`, and a bcrypt hash of `ADMIN_PASSWORD`.
- One active membership in that tenant.
- One tenant-scoped `SUPER_ADMIN` role and role assignment.
- Canonical permission rows attached to the role.
- Default finance setup: `main` cash account, `jimpitan` income category, `income-other` income category, and `expense-operational` expense category.
- A `SYSTEM` audit log entry that does not include the password or password hash.

Safety behavior:

- If any user already exists, the command refuses to run.
- Use `--force` only to repair missing bootstrap records after an interrupted first run or an intentional controlled recovery.
- The command does not create demo residents, houses, collections, transactions, or fake activity.
- The password is never printed. Prefer environment injection over CLI password args to avoid shell history.

CLI args are also supported:

```bash
npm run bootstrap:admin -- \
  --admin-email admin@example.com \
  --admin-password 'use-a-strong-private-password' \
  --admin-name 'Initial Admin' \
  --tenant-name 'RT 001' \
  --tenant-slug rt001
```

Password policy:

- At least 12 characters.
- Includes uppercase, lowercase, number, and symbol.
- Contains no spaces.
- Does not include obvious admin email, admin name, tenant name, or tenant slug terms.

After bootstrap, verify login against the public app with `ADMIN_EMAIL` and the private password, then store the password in the deployment password manager.
