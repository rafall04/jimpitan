#!/usr/bin/env sh
# Purpose: PostgreSQL restore foundation for VPS-hosted JIMPITAN deployments.
# Caller: Operators during disaster recovery or staging refreshes.
# Deps: docker compose, gzip for .gz files, compose.prod.yaml, and PostgreSQL service env vars.
# MainFuncs: Streams a custom-format or SQL backup into the Compose postgres service after explicit confirmation.
# SideEffects: Writes SQL statements into the target PostgreSQL database.

set -eu

if [ "$#" -ne 1 ]; then
  printf 'usage: %s path/to/backup.dump[.gz]|backup.sql[.gz]\n' "$0" >&2
  exit 2
fi

if [ "${ALLOW_DESTRUCTIVE_RESTORE:-}" != "yes" ]; then
  printf 'set ALLOW_DESTRUCTIVE_RESTORE=yes to restore into the configured database\n' >&2
  exit 3
fi

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yaml}"
ENV_FILE="${ENV_FILE:-.env}"
POSTGRES_DB="${POSTGRES_DB:-jimpitan}"
POSTGRES_USER="${POSTGRES_USER:-jimpitan}"
BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  printf 'backup file not found: %s\n' "$BACKUP_FILE" >&2
  exit 4
fi

case "$BACKUP_FILE" in
  *.dump.gz) gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" ;;
  *.dump) docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BACKUP_FILE" ;;
  *.sql.gz) gzip -dc "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres psql --set ON_ERROR_STOP=on --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" ;;
  *.sql) docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres psql --set ON_ERROR_STOP=on --single-transaction -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BACKUP_FILE" ;;
  *) printf 'unsupported backup format: %s\n' "$BACKUP_FILE" >&2; exit 5 ;;
esac
