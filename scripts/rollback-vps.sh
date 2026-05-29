#!/usr/bin/env bash
# Purpose: Safe VPS rollback helper for JIMPITAN host-Nginx deployments.
# Caller: Root operators reverting a failed JIMPITAN VPS install or update.
# Deps: bash, docker compose, nginx, systemctl, compose.prod.yaml, compose.vps-nginx.yaml, .env.production, optional Nginx backup.
# MainFuncs: Stops JIMPITAN containers without deleting volumes, restores a JIMPITAN Nginx backup, validates Nginx, and optionally reloads it.
# SideEffects: Stops/removes JIMPITAN containers and may replace /etc/nginx/sites-available/jimpitan.conf and reload Nginx.

set -euo pipefail

DRY_RUN=false
NO_RELOAD=false
ENV_FILE="${JIMPITAN_ENV_FILE:-.env.production}"
COMPOSE_PROD_FILE="compose.prod.yaml"
COMPOSE_OVERRIDE_FILE="compose.vps-nginx.yaml"
LOG_FILE="${JIMPITAN_ROLLBACK_LOG:-rollback-jimpitan.log}"
NGINX_AVAILABLE="/etc/nginx/sites-available/jimpitan.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/jimpitan.conf"
BACKUP_PATH=""
COMPOSE_ARGS=(-f "$COMPOSE_PROD_FILE" -f "$COMPOSE_OVERRIDE_FILE" --env-file "$ENV_FILE")

usage() {
  cat <<'USAGE'
Usage: ./scripts/rollback-vps.sh [--dry-run] [--backup /path/to/jimpitan.conf.bak] [--no-reload]

Options:
  --dry-run       Show rollback actions without changing containers or Nginx files.
  --backup PATH   Restore a specific Nginx backup. Defaults to the newest jimpitan.conf.bak.* file.
  --no-reload     Validate Nginx but do not reload it.
USAGE
}

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

init_logging() {
  touch "$LOG_FILE"
  chmod 600 "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
  log "Rollback started. dry_run=$DRY_RUN no_reload=$NO_RELOAD"
}

parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --dry-run) DRY_RUN=true ;;
      --no-reload) NO_RELOAD=true ;;
      --backup)
        shift
        [[ "$#" -gt 0 ]] || die "--backup requires a path"
        BACKUP_PATH="$1"
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        usage >&2
        die "Unknown option: $1"
        ;;
    esac
    shift
  done
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "This rollback helper must run as root. Re-run with sudo or as root."
  fi
}

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: $*"
    return 0
  fi

  log "RUN: $*"
  "$@"
}

confirm() {
  local prompt="$1"
  local answer

  if [[ -r /dev/tty ]]; then
    read -r -p "$prompt [y/N]: " answer < /dev/tty
  else
    read -r -p "$prompt [y/N]: " answer
  fi

  [[ "$answer" =~ ^([yY]|[yY][eE][sS])$ ]]
}

require_commands() {
  command -v docker >/dev/null 2>&1 || die "Required command not found: docker"
  docker compose version >/dev/null 2>&1 || die "Required command not available: docker compose"
  command -v nginx >/dev/null 2>&1 || die "Required command not found: nginx"
}

stop_containers() {
  if [[ ! -f "$COMPOSE_OVERRIDE_FILE" ]]; then
    log "$COMPOSE_OVERRIDE_FILE not found; skipping Docker Compose down."
    return 0
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    log "$ENV_FILE not found; Docker Compose may still resolve defaults but private env is missing."
  fi

  run_cmd env APP_ENV_FILE="$ENV_FILE" docker compose "${COMPOSE_ARGS[@]}" down
  log "Docker volumes were not deleted."
}

latest_backup() {
  find /etc/nginx/sites-available -maxdepth 1 -type f -name 'jimpitan.conf.bak.*' -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk 'NR == 1 { print $2 }'
}

restore_nginx_backup() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: would restore latest or specified JIMPITAN Nginx backup after confirmation."
    return 0
  fi

  if [[ -z "$BACKUP_PATH" ]]; then
    BACKUP_PATH="$(latest_backup)"
  fi

  if [[ -n "$BACKUP_PATH" ]]; then
    [[ -f "$BACKUP_PATH" ]] || die "Nginx backup not found: $BACKUP_PATH"
    if confirm "Restore Nginx backup $BACKUP_PATH to $NGINX_AVAILABLE?"; then
      run_cmd cp -a "$BACKUP_PATH" "$NGINX_AVAILABLE"
      if [[ ! -L "$NGINX_ENABLED" ]]; then
        run_cmd ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
      fi
    else
      log "Nginx backup restore declined."
    fi
    return 0
  fi

  log "No jimpitan.conf.bak.* backup found."
  if [[ -L "$NGINX_ENABLED" ]] && confirm "Disable current JIMPITAN Nginx symlink $NGINX_ENABLED?"; then
    run_cmd rm -f "$NGINX_ENABLED"
  else
    log "Current JIMPITAN Nginx config left unchanged."
  fi
}

validate_and_reload_nginx() {
  run_cmd nginx -t

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: would ask for confirmation before reloading Nginx."
    return 0
  fi

  if [[ "$NO_RELOAD" == "true" ]]; then
    log "Nginx reload skipped by --no-reload."
    return 0
  fi

  if confirm "Reload Nginx now?"; then
    run_cmd systemctl reload nginx
  else
    log "Nginx reload declined."
  fi
}

main() {
  parse_args "$@"
  require_root
  init_logging
  require_commands
  stop_containers
  restore_nginx_backup
  validate_and_reload_nginx
  log "Rollback finished. Review $LOG_FILE for details."
}

main "$@"
