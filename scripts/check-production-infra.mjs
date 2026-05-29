/**
 * Purpose: Static production infrastructure safety checks.
 * Caller: npm run infra:check and deployment verification workflows.
 * Deps: Node.js fs module plus Compose, staging override, API/worker Dockerfiles, Nginx, and backup script files.
 * MainFuncs: Verifies production exposure, staging host-Nginx exposure, env guards, health checks, Docker build script availability, proxy headers, public URL requirements, and backup restore safety markers.
 * SideEffects: Reads infrastructure files and writes findings to stdout/stderr.
 */
import { readFileSync } from 'node:fs';

const prodCompose = readFileSync('compose.prod.yaml', 'utf8');
const stagingCompose = readFileSync('compose.staging.yaml', 'utf8');
const apiDockerfile = readFileSync('apps/api/Dockerfile', 'utf8');
const workerDockerfile = readFileSync('apps/api/Dockerfile.worker', 'utf8');
const nginx = readFileSync('infrastructure/nginx/nginx.conf', 'utf8');
const backup = readFileSync('scripts/backup-postgres.sh', 'utf8');
const restore = readFileSync('scripts/restore-postgres.sh', 'utf8');
const services = ['postgres', 'redis', 'api', 'worker', 'web', 'nginx'];
const failures = [];

for (const service of services) {
  const block = serviceBlock(prodCompose, service);
  if (!block.includes('healthcheck:')) {
    failures.push(`compose.prod.yaml:${service} missing healthcheck`);
  }
}

for (const service of ['postgres', 'redis', 'api', 'worker', 'web']) {
  const block = serviceBlock(prodCompose, service);
  if (/^\s+ports:/m.test(block)) {
    failures.push(`compose.prod.yaml:${service} must not publish host ports`);
  }
}

if (!serviceBlock(prodCompose, 'nginx').includes('${HTTP_PORT:-80}:80')) {
  failures.push('compose.prod.yaml:nginx must be the only public HTTP port');
}
if (!serviceBlock(stagingCompose, 'api').includes('127.0.0.1:${JIMPITAN_API_HOST_PORT:-3101}:3001')) {
  failures.push('compose.staging.yaml:api must publish only loopback port 3101');
}
if (!serviceBlock(stagingCompose, 'web').includes('127.0.0.1:${JIMPITAN_WEB_HOST_PORT:-3100}:3000')) {
  failures.push('compose.staging.yaml:web must publish only loopback port 3100');
}
if (!serviceBlock(stagingCompose, 'nginx').includes('docker-nginx-disabled-for-host-proxy')) {
  failures.push('compose.staging.yaml:nginx must be disabled by profile for host Nginx deployments');
}
if (!serviceBlock(stagingCompose, 'nginx').includes('ports: !reset []')) {
  failures.push('compose.staging.yaml:nginx must reset inherited host ports');
}
if (!prodCompose.includes('${APP_ENV_FILE:?APP_ENV_FILE must point to a private production env file}')) {
  failures.push('compose.prod.yaml must require APP_ENV_FILE');
}
if (!prodCompose.includes('${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}')) {
  failures.push('compose.prod.yaml must require POSTGRES_PASSWORD');
}
if (!prodCompose.includes('${NEXT_PUBLIC_API_BASE_URL:?NEXT_PUBLIC_API_BASE_URL is required}')) {
  failures.push('compose.prod.yaml must require NEXT_PUBLIC_API_BASE_URL');
}
if (!prodCompose.includes('${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL is required}')) {
  failures.push('compose.prod.yaml must require NEXT_PUBLIC_APP_URL');
}
for (const [name, source] of [
  ['apps/api/Dockerfile', apiDockerfile],
  ['apps/api/Dockerfile.worker', workerDockerfile],
]) {
  if (!copiesPrismaCommandScriptBeforeGenerate(source)) {
    failures.push(`${name} must copy scripts/run-prisma-schema-command.mjs before npm run prisma:generate`);
  }
}
for (const header of ['X-Forwarded-Host', 'X-Forwarded-Port', 'X-Forwarded-Proto', 'X-Request-Id']) {
  if (!nginx.includes(header)) {
    failures.push(`nginx.conf missing ${header}`);
  }
}
if (!nginx.includes('map $http_upgrade $connection_upgrade')) {
  failures.push('nginx.conf missing connection upgrade map');
}
if (!backup.includes('pg_dump --format=custom --no-owner --no-acl')) {
  failures.push('backup-postgres.sh must use custom-format pg_dump without owner/ACL');
}
if (!restore.includes('ALLOW_DESTRUCTIVE_RESTORE')) {
  failures.push('restore-postgres.sh must require destructive restore confirmation');
}
if (!restore.includes('pg_restore --clean --if-exists --no-owner --no-acl')) {
  failures.push('restore-postgres.sh must use safe pg_restore flags for dump files');
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log('Production infrastructure static checks passed.');

function serviceBlock(source, service) {
  const match = source.match(new RegExp(`\\n  ${service}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\nvolumes:\\n|\\nnetworks:\\n|$)`));
  return match?.[1] ?? '';
}

function copiesPrismaCommandScriptBeforeGenerate(source) {
  const copyIndex = source.indexOf('COPY scripts/run-prisma-schema-command.mjs ./scripts/run-prisma-schema-command.mjs');
  const generateIndex = source.indexOf('RUN npm run prisma:generate');
  return copyIndex !== -1 && generateIndex !== -1 && copyIndex < generateIndex;
}
