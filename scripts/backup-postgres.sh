#!/usr/bin/env sh
# Purpose: PostgreSQL backup foundation for VPS-hosted JIMPITAN deployments.
# Caller: Operators, cron jobs, and deployment runbooks.
# Deps: docker compose, gzip, find, compose.prod.yaml, and PostgreSQL service env vars.
# MainFuncs: Runs pg_dump custom-format backup inside Compose postgres, compresses it, and prunes old local backups.
# SideEffects: Creates a timestamped backup artifact on the host filesystem.

set -eu

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-backups/postgres}"
POSTGRES_DB="${POSTGRES_DB:-jimpitan}"
POSTGRES_USER="${POSTGRES_USER:-jimpitan}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
OUTPUT_FILE="${BACKUP_DIR}/jimpitan-${POSTGRES_DB}-${TIMESTAMP}.dump.gz"

mkdir -p "$BACKUP_DIR"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -c > "$OUTPUT_FILE"

find "$BACKUP_DIR" -type f -name "jimpitan-${POSTGRES_DB}-*.dump.gz" -mtime +"$RETENTION_DAYS" -delete

printf '%s\n' "$OUTPUT_FILE"
