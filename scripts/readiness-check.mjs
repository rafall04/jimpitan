/**
 * Purpose: Production readiness and security checks.
 * Caller: npm run readiness:check, CI pipelines, and pre-deployment verification.
 * Deps: Compose files, env examples, Nginx config, package scripts, docs, and infrastructure scripts.
 * MainFuncs: Verifies critical env, auth, proxy, health, worker, storage, backup, and command-surface readiness markers.
 * SideEffects: Reads repository files and exits non-zero on critical readiness gaps.
 */

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const READINESS_CHECK_CONTRACT = Object.freeze({
  checks: [
    "env-validation",
    "auth-cookie-token-safety",
    "cors-production-policy",
    "rate-limit-foundation",
    "proxy-forwarded-headers",
    "public-data-leak-tests",
    "rbac-tests",
    "tenant-isolation-tests",
    "backup-restore-docs",
    "health-checks",
    "logging-foundation",
    "compose-exposure-policy",
    "volume-strategy",
    "worker-queue-risks",
  ],
});

export async function runReadinessChecks() {
  const failures = [];
  const warnings = [];

  const files = {
    packageJson: "package.json",
    prodCompose: "compose.prod.yaml",
    devCompose: "compose.dev.yaml",
    nginx: "infrastructure/nginx/nginx.conf",
    rootEnv: "env.example",
    apiEnv: "apps/api/env.example",
    webEnv: "apps/web/env.example",
    gitignore: ".gitignore",
    apiMain: "apps/api/src/main.ts",
    apiEnvValidation: "apps/api/src/config/env.validation.ts",
    webCookies: "apps/web/src/features/auth/session-cookies.server.ts",
    webCsrf: "apps/web/src/features/auth/csrf.server.ts",
    backendProxy: "apps/web/src/app/api/backend/[...path]/route.ts",
    apiHealth: "apps/api/src/health/health.controller.ts",
    webHealth: "apps/web/src/app/api/health/route.ts",
    workerMain: "apps/api/src/worker/main.ts",
    workerService: "apps/api/src/worker/worker.service.ts",
    backup: "scripts/backup-postgres.sh",
    restore: "scripts/restore-postgres.sh",
    deploymentDocs: "docs/deployment/README.md",
    testingDocs: "docs/testing/README.md",
    readinessDocs: "docs/production-readiness/README.md",
    infraCheck: "scripts/check-production-infra.mjs",
    e2eCheck: "scripts/e2e-check.mjs",
    smokeCheck: "scripts/smoke-check.mjs",
    readinessCheck: "scripts/readiness-check.mjs",
  };

  for (const [label, file] of Object.entries(files)) {
    if (!existsSync(file)) {
      failures.push(`${label}: missing ${file}`);
    }
  }

  const packageJson = read(files.packageJson);
  for (const script of ["test:e2e", "test:smoke", "readiness:check", "infra:check", "scan:imports", "prisma:validate"]) {
    requireIncludes(packageJson, `"${script}"`, `package.json missing ${script} script`, failures);
  }

  const skeletonMarker = ["SDD", "skeleton only"].join(" ");
  for (const file of [files.e2eCheck, files.smokeCheck, files.readinessCheck]) {
    requireNotIncludes(read(file), skeletonMarker, `${file} still contains skeleton-only blocker`, failures);
  }

  const prodCompose = read(files.prodCompose);
  for (const service of ["postgres", "redis", "api", "worker", "web", "nginx"]) {
    const block = serviceBlock(prodCompose, service);
    requireIncludes(block, "restart: unless-stopped", `compose.prod.yaml:${service} missing restart policy`, failures);
    requireIncludes(block, "healthcheck:", `compose.prod.yaml:${service} missing healthcheck`, failures);
  }
  for (const service of ["postgres", "redis", "api", "worker", "web"]) {
    if (/^\s+ports:/m.test(serviceBlock(prodCompose, service))) {
      failures.push(`compose.prod.yaml:${service} must not publish host ports`);
    }
  }
  for (const marker of [
    "${APP_ENV_FILE:?APP_ENV_FILE must point to a private production env file}",
    "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}",
    "${NEXT_PUBLIC_API_BASE_URL:?NEXT_PUBLIC_API_BASE_URL is required}",
    "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}",
    "postgres_data:",
    "upload_data:",
    "export_data:",
    "WORKER_QUEUES:",
  ]) {
    requireIncludes(prodCompose, marker, `compose.prod.yaml missing ${marker}`, failures);
  }

  const nginx = read(files.nginx);
  for (const marker of [
    "server_tokens off",
    "client_max_body_size",
    "limit_req_zone",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Content-Security-Policy",
    "X-Forwarded-For",
    "X-Forwarded-Proto",
    "X-Forwarded-Host",
    "X-Forwarded-Port",
    "X-Request-Id",
  ]) {
    requireIncludes(nginx, marker, `nginx.conf missing ${marker}`, failures);
  }

  const gitignore = read(files.gitignore);
  requireIncludes(gitignore, ".env", ".gitignore must ignore env files", failures);
  requireIncludes(gitignore, ".env.*", ".gitignore must ignore local env files", failures);

  const envValidation = read(files.apiEnvValidation);
  for (const marker of [
    "placeholderPattern",
    "NODE_ENV !== 'production'",
    "CORS_ALLOWED_ORIGINS must use HTTPS",
    "BOT_WEBHOOK_URL must use HTTPS",
    "JWT_ACCESS_SECRET",
    "32 characters",
  ]) {
    requireIncludes(envValidation, marker, `env.validation.ts missing ${marker}`, failures);
  }

  const webCookies = read(files.webCookies);
  for (const marker of ["httpOnly: true", "process.env.NODE_ENV === 'production'", "sameSite: 'lax'"]) {
    requireIncludes(webCookies, marker, `session cookies missing ${marker}`, failures);
  }

  const webCsrf = read(files.webCsrf);
  const backendProxy = read(files.backendProxy);
  requireIncludes(webCsrf, "isSameOriginRequest", "csrf helper missing same-origin validator", failures);
  requireIncludes(backendProxy, "STATE_CHANGING_METHODS", "backend proxy missing state-changing method guard", failures);
  requireIncludes(backendProxy, "!isSameOriginRequest", "backend proxy missing CSRF rejection", failures);

  const apiMain = read(files.apiMain);
  requireIncludes(apiMain, "enableShutdownHooks", "API missing graceful shutdown hook", failures);
  requireIncludes(apiMain, "set('trust proxy'", "API missing explicit trust proxy handling", failures);
  requireIncludes(apiMain, "enableCors", "API missing CORS configuration path", failures);

  requireIncludes(read(files.workerMain), "SIGTERM", "worker missing SIGTERM handler", failures);
  requireIncludes(read(files.workerMain), "app.close", "worker missing Nest app close on shutdown", failures);
  requireIncludes(read(files.workerService), "worker.runOnce", "worker missing run-once mode for verification", failures);
  requireIncludes(read(files.workerService), "writeHealth", "worker missing heartbeat write", failures);

  requireIncludes(read(files.apiHealth), "SELECT 1", "API readiness missing database probe", failures);
  requireIncludes(read(files.webHealth), "jimpitan-web", "web health endpoint missing service marker", failures);
  requireIncludes(read(files.backup), "pg_dump --format=custom --no-owner --no-acl", "backup script missing safe pg_dump flags", failures);
  requireIncludes(read(files.restore), "ALLOW_DESTRUCTIVE_RESTORE", "restore script missing destructive confirmation", failures);

  if (!existsSync(".github/workflows")) {
    warnings.push("CI workflow foundation is missing; run launch checks manually until CI is added.");
  }
  if (!existsSync("playwright.config.ts")) {
    warnings.push("Playwright runtime config is missing; E2E journey specs remain a documented gap.");
  }
  if (read("tests/e2e/critical-journeys.spec.ts").includes("describe.skip")) {
    warnings.push("Critical E2E journeys are scaffolded but skipped; manual MVP journey verification remains required.");
  }

  for (const warning of warnings) {
    console.warn(`WARN ${warning}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Production readiness static checks passed with ${warnings.length} warning(s).`);
}

function read(file) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function requireIncludes(source, marker, message, failures) {
  if (!source.includes(marker)) {
    failures.push(message);
  }
}

function requireNotIncludes(source, marker, message, failures) {
  if (source.includes(marker)) {
    failures.push(message);
  }
}

function serviceBlock(source, service) {
  const match = source.match(new RegExp(`\\n  ${service}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:\\n|\\nnetworks:\\n|$)`));
  return match?.[1] ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runReadinessChecks();
}
