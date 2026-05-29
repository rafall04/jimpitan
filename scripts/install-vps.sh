#!/usr/bin/env bash
# Purpose: Safe semi-automatic VPS installer for JIMPITAN behind an existing host Nginx.
# Caller: Root operators deploying or updating JIMPITAN on a shared VPS.
# Deps: bash, docker compose, git, curl, openssl, nginx, systemctl, optional certbot, compose.prod.yaml, env.example.
# MainFuncs: Preflight checks, env/secret preparation, VPS Compose override creation, container start, migration, health checks, Nginx server block, optional SSL, smoke checks.
# SideEffects: Writes .env.production, compose.vps-nginx.yaml, /etc/nginx/sites-available/jimpitan.conf, symlink under sites-enabled, starts containers, may reload Nginx and request certificates.

set -euo pipefail

DRY_RUN=false
NO_SSL=false
UPDATE_MODE=false

ENV_FILE="${JIMPITAN_ENV_FILE:-.env.production}"
ENV_EXAMPLE_PRIMARY=".env.example"
ENV_EXAMPLE_FALLBACK="env.example"
COMPOSE_PROD_FILE="compose.prod.yaml"
COMPOSE_OVERRIDE_FILE="compose.vps-nginx.yaml"
LOG_FILE="${JIMPITAN_INSTALL_LOG:-install-jimpitan.log}"
NGINX_AVAILABLE="/etc/nginx/sites-available/jimpitan.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/jimpitan.conf"
WEB_PORT="3100"
API_PORT="3101"
CLIENT_MAX_BODY_SIZE="${JIMPITAN_CLIENT_MAX_BODY_SIZE:-20m}"
LAST_NGINX_BACKUP=""
NGINX_RELOADED=false
SSL_ENABLED=false

DOMAIN="${JIMPITAN_DOMAIN:-}"
PUBLIC_APP_URL="${JIMPITAN_PUBLIC_APP_URL:-}"
PUBLIC_API_URL="${JIMPITAN_PUBLIC_API_URL:-}"
ADMIN_EMAIL="${JIMPITAN_ADMIN_EMAIL:-}"

COMPOSE_ARGS=(-f "$COMPOSE_PROD_FILE" -f "$COMPOSE_OVERRIDE_FILE" --env-file "$ENV_FILE")

usage() {
  cat <<'USAGE'
Usage: ./scripts/install-vps.sh [--dry-run] [--no-ssl] [--update]

Options:
  --dry-run  Show planned actions without writing files, starting containers, reloading Nginx, or running certbot.
  --no-ssl   Skip certbot prompts and HTTPS certificate setup.
  --update   Pull the repository, rebuild/restart containers, run migrations, and health-check without rewriting Nginx unless missing.
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
  log "Installer started. dry_run=$DRY_RUN no_ssl=$NO_SSL update=$UPDATE_MODE"
}

parse_args() {
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --dry-run) DRY_RUN=true ;;
      --no-ssl) NO_SSL=true ;;
      --update) UPDATE_MODE=true ;;
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
    die "This installer must run as root. Re-run with sudo or as root."
  fi
}

require_commands() {
  local required=(docker git curl openssl nginx)
  local cmd

  for cmd in "${required[@]}"; do
    command -v "$cmd" >/dev/null 2>&1 || die "Required command not found: $cmd"
  done

  docker compose version >/dev/null 2>&1 || die "Required command not available: docker compose"
}

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: $*"
    return 0
  fi

  log "RUN: $*"
  "$@"
}

compose_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: APP_ENV_FILE=$ENV_FILE docker compose ${COMPOSE_ARGS[*]} $*"
    return 0
  fi

  APP_ENV_FILE="$ENV_FILE" docker compose "${COMPOSE_ARGS[@]}" "$@"
}

port_owner() {
  local port="$1"

  if command -v ss >/dev/null 2>&1; then
    ss -H -ltnp 2>/dev/null | awk -v port=":$port" '$4 ~ port "$" { print }'
    return 0
  fi

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    return 0
  fi

  log "WARNING: neither ss nor lsof is available; cannot inspect port $port ownership."
}

check_required_ports() {
  local owner

  if [[ "$UPDATE_MODE" == "true" ]]; then
    log "Update mode: skipping $WEB_PORT/$API_PORT conflict failure because existing JIMPITAN containers may already own them."
    return 0
  fi

  owner="$(port_owner "$WEB_PORT")"
  [[ -z "$owner" ]] || die "Port $WEB_PORT is already in use. JIMPITAN web must bind to 127.0.0.1:$WEB_PORT."

  owner="$(port_owner "$API_PORT")"
  [[ -z "$owner" ]] || die "Port $API_PORT is already in use. JIMPITAN API must bind to 127.0.0.1:$API_PORT."

  log "Ports $WEB_PORT and $API_PORT are available."
}

warn_public_port_ownership() {
  local port owner

  for port in 80 443; do
    owner="$(port_owner "$port")"
    if [[ -n "$owner" ]]; then
      log "WARNING: public port $port is already owned. Existing service will not be stopped:"
      printf '%s\n' "$owner"
    else
      log "Public port $port has no visible listener."
    fi
  done
}

read_from_tty() {
  local prompt="$1"
  local value

  if [[ -r /dev/tty ]]; then
    read -r -p "$prompt" value < /dev/tty
  else
    read -r -p "$prompt" value
  fi

  printf '%s' "$value"
}

read_secret_from_tty() {
  local prompt="$1"
  local value

  if [[ -r /dev/tty ]]; then
    read -r -s -p "$prompt" value < /dev/tty
    printf '\n' > /dev/tty
  else
    read -r -s -p "$prompt" value
    printf '\n' >&2
  fi

  printf '%s' "$value"
}

confirm() {
  local prompt="$1"
  local answer

  answer="$(read_from_tty "$prompt [y/N]: ")"
  [[ "$answer" =~ ^([yY]|[yY][eE][sS])$ ]]
}

prompt_required() {
  local var_name="$1"
  local prompt="$2"
  local value="${!var_name:-}"

  while [[ -z "$value" ]]; do
    value="$(read_from_tty "$prompt: ")"
  done

  printf -v "$var_name" '%s' "$value"
}

derive_domain_from_url() {
  local url="$1"
  local host

  host="${url#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  printf '%s' "$host"
}

validate_inputs() {
  [[ "$DOMAIN" != *"/"* ]] || die "Domain must be a hostname only, without scheme or path."
  [[ "$PUBLIC_APP_URL" =~ ^https?:// ]] || die "Public app URL must start with http:// or https://."
  [[ "$PUBLIC_API_URL" =~ ^https?:// ]] || die "Public API URL must start with http:// or https://."
}

load_public_values_from_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi

  PUBLIC_APP_URL="${PUBLIC_APP_URL:-$(env_get NEXT_PUBLIC_APP_URL)}"
  PUBLIC_API_URL="${PUBLIC_API_URL:-$(env_get NEXT_PUBLIC_API_BASE_URL)}"

  if [[ -z "$DOMAIN" && -n "$PUBLIC_APP_URL" ]]; then
    DOMAIN="$(derive_domain_from_url "$PUBLIC_APP_URL")"
  fi
}

collect_inputs() {
  local needs_inputs=false
  local ssl_answer

  load_public_values_from_env

  if [[ "$UPDATE_MODE" != "true" || ! -f "$NGINX_AVAILABLE" || ! -f "$ENV_FILE" ]]; then
    needs_inputs=true
  fi

  if [[ "$needs_inputs" == "true" ]]; then
    prompt_required DOMAIN "Domain name for JIMPITAN"
    prompt_required PUBLIC_APP_URL "Public app URL"
    prompt_required PUBLIC_API_URL "Public API URL"
  fi

  validate_inputs

  if [[ "$NO_SSL" == "true" ]]; then
    SSL_ENABLED=false
    log "SSL disabled by --no-ssl."
    return 0
  fi

  ssl_answer="${JIMPITAN_ENABLE_SSL:-}"
  if [[ -n "$ssl_answer" ]]; then
    [[ "$ssl_answer" =~ ^([yY]|[yY][eE][sS]|true|TRUE|1)$ ]] && SSL_ENABLED=true || SSL_ENABLED=false
  elif [[ "$needs_inputs" == "true" ]]; then
    if confirm "Enable SSL via certbot for $DOMAIN?"; then
      SSL_ENABLED=true
    else
      SSL_ENABLED=false
    fi
  fi

  if [[ "$SSL_ENABLED" == "true" && -z "$ADMIN_EMAIL" ]]; then
    ADMIN_EMAIL="$(read_from_tty "Admin email for certbot renewal notices (blank to continue without email): ")"
  fi
}

select_env_example() {
  if [[ -f "$ENV_EXAMPLE_PRIMARY" ]]; then
    printf '%s' "$ENV_EXAMPLE_PRIMARY"
    return 0
  fi

  if [[ -f "$ENV_EXAMPLE_FALLBACK" ]]; then
    printf '%s' "$ENV_EXAMPLE_FALLBACK"
    return 0
  fi

  die "No env example found. Expected $ENV_EXAMPLE_PRIMARY or $ENV_EXAMPLE_FALLBACK."
}

env_get() {
  local key="$1"

  if [[ ! -f "$ENV_FILE" ]]; then
    return 0
  fi

  grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f 2- || true
}

is_placeholder_or_empty() {
  local value="$1"

  [[ -z "$value" || "$value" =~ replace-with || "$value" =~ change-me || "$value" =~ example\.com ]]
}

set_env_var() {
  local key="$1"
  local value="$2"
  local tmp

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: set $key in $ENV_FILE"
    return 0
  fi

  tmp="$(mktemp)"
  if grep -q -E "^${key}=" "$ENV_FILE"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { replaced = 0 }
      $0 ~ "^" key "=" {
        print key "=" value
        replaced = 1
        next
      }
      { print }
      END {
        if (replaced == 0) {
          print key "=" value
        }
      }
    ' "$ENV_FILE" > "$tmp"
  else
    cp "$ENV_FILE" "$tmp"
    printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi

  install -m 600 "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}

generate_secret() {
  openssl rand -hex 32
}

ensure_secret() {
  local key="$1"
  local value

  value="$(env_get "$key")"
  if is_placeholder_or_empty "$value"; then
    set_env_var "$key" "$(generate_secret)"
    log "Generated strong value for $key."
  else
    log "$key already set; keeping existing value."
  fi
}

ensure_secret_alias_pair() {
  local requested_key="$1"
  local runtime_key="$2"
  local requested_value runtime_value generated

  requested_value="$(env_get "$requested_key")"
  runtime_value="$(env_get "$runtime_key")"

  if ! is_placeholder_or_empty "$requested_value"; then
    set_env_var "$runtime_key" "$requested_value"
    log "$requested_key already set; synchronized $runtime_key."
    return 0
  fi

  if ! is_placeholder_or_empty "$runtime_value"; then
    set_env_var "$requested_key" "$runtime_value"
    log "$runtime_key already set; synchronized $requested_key."
    return 0
  fi

  generated="$(generate_secret)"
  set_env_var "$requested_key" "$generated"
  set_env_var "$runtime_key" "$generated"
  log "Generated strong value for $requested_key and $runtime_key."
}

ensure_bot_token() {
  local value input

  value="$(env_get BOT_TOKEN)"
  if ! is_placeholder_or_empty "$value"; then
    log "BOT_TOKEN already set; keeping existing value."
    return 0
  fi

  input="${JIMPITAN_BOT_TOKEN:-}"
  if [[ -z "$input" && "$DRY_RUN" != "true" ]]; then
    input="$(read_secret_from_tty "Telegram bot token (hidden, blank creates a temporary disabled token): ")"
  fi

  if [[ -z "$input" ]]; then
    input="telegram-disabled-$(openssl rand -hex 24)"
    log "BOT_TOKEN was missing or placeholder; wrote a temporary value. Replace it before enabling Telegram delivery."
  else
    log "BOT_TOKEN set from operator input."
  fi

  set_env_var BOT_TOKEN "$input"
}

prepare_env_file() {
  local example postgres_db postgres_user postgres_password webhook_url

  if [[ ! -f "$ENV_FILE" ]]; then
    example="$(select_env_example)"
    if [[ "$DRY_RUN" == "true" ]]; then
      log "DRY-RUN: copy $example to $ENV_FILE"
    else
      install -m 600 "$example" "$ENV_FILE"
      log "Created $ENV_FILE from $example."
    fi
  else
    log "$ENV_FILE already exists; keeping existing values unless missing or unsafe placeholders are found."
  fi

  set_env_var APP_ENV_FILE "$ENV_FILE"
  set_env_var NODE_ENV production
  set_env_var APP_ENV production
  set_env_var TRUST_PROXY_HOPS 1
  set_env_var CORS_ALLOWED_ORIGINS ""
  set_env_var JIMPITAN_WEB_HOST_PORT "$WEB_PORT"
  set_env_var JIMPITAN_API_HOST_PORT "$API_PORT"
  set_env_var NEXT_PUBLIC_APP_URL "$PUBLIC_APP_URL"
  set_env_var NEXT_PUBLIC_API_BASE_URL "$PUBLIC_API_URL"
  set_env_var BOT_WEBHOOK_URL "${PUBLIC_API_URL%/}/telegram/webhook"

  ensure_secret_alias_pair JWT_SECRET JWT_ACCESS_SECRET
  ensure_secret JWT_REFRESH_SECRET
  ensure_secret_alias_pair TELEGRAM_WEBHOOK_SECRET BOT_WEBHOOK_SECRET
  ensure_secret POSTGRES_PASSWORD
  ensure_bot_token

  postgres_db="$(env_get POSTGRES_DB)"
  postgres_user="$(env_get POSTGRES_USER)"
  postgres_password="$(env_get POSTGRES_PASSWORD)"
  postgres_db="${postgres_db:-jimpitan}"
  postgres_user="${postgres_user:-jimpitan}"
  webhook_url="$(env_get BOT_WEBHOOK_URL)"

  set_env_var DATABASE_URL "postgresql://${postgres_user}:${postgres_password}@postgres:5432/${postgres_db}?schema=public"
  if [[ ! "$webhook_url" =~ ^https:// ]]; then
    set_env_var BOT_WEBHOOK_URL "https://${DOMAIN}/api/v1/telegram/webhook"
    log "BOT_WEBHOOK_URL forced to HTTPS because production API validation requires it."
  fi
}

ensure_compose_override() {
  if [[ -f "$COMPOSE_OVERRIDE_FILE" ]]; then
    log "$COMPOSE_OVERRIDE_FILE already exists; not overwriting."
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: create $COMPOSE_OVERRIDE_FILE with loopback-only web/API ports and disabled Docker Nginx profile."
    return 0
  fi

  cat > "$COMPOSE_OVERRIDE_FILE" <<'YAML'
# Purpose: Existing-VPS host-Nginx override generated by scripts/install-vps.sh.
# Caller: Root operators running JIMPITAN on a VPS that already has host Nginx.
# Deps: compose.prod.yaml, host Nginx, Docker Compose profiles.
# MainFuncs: Binds web/API only to localhost and disables the Docker nginx service by profile.
# SideEffects: Changes Docker Compose host port bindings for web/API and prevents Docker nginx from publishing 80/443.

services:
  api:
    ports:
      - "127.0.0.1:${JIMPITAN_API_HOST_PORT:-3101}:3001"
    environment:
      TRUST_PROXY_HOPS: ${TRUST_PROXY_HOPS:-1}
      CORS_ALLOWED_ORIGINS: ${CORS_ALLOWED_ORIGINS:-}

  web:
    ports:
      - "127.0.0.1:${JIMPITAN_WEB_HOST_PORT:-3100}:3000"

  nginx:
    profiles:
      - docker-nginx-disabled-for-host-proxy
    ports: !reset []
YAML
  log "Created $COMPOSE_OVERRIDE_FILE."
}

validate_compose_config() {
  log "Validating Docker Compose config."
  if [[ "$DRY_RUN" == "true" ]]; then
    compose_cmd config
  else
    compose_cmd config >/dev/null
  fi
}

git_update_if_requested() {
  if [[ "$UPDATE_MODE" == "true" ]]; then
    run_cmd git pull
  fi
}

start_containers() {
  log "Building and starting JIMPITAN containers without Docker Nginx."
  compose_cmd up -d --build
}

run_migrations() {
  log "Running Prisma migrations inside api container."
  compose_cmd exec -T api npx prisma migrate deploy --schema prisma/schema.prisma
}

container_status() {
  local container_id="$1"

  docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || {
    printf 'missing missing'
  }
}

wait_for_service_health() {
  local service="$1"
  local attempt container_id status health state

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: wait for healthy service $service"
    return 0
  fi

  for attempt in $(seq 1 40); do
    container_id="$(APP_ENV_FILE="$ENV_FILE" docker compose "${COMPOSE_ARGS[@]}" ps -q "$service")"
    if [[ -n "$container_id" ]]; then
      status="$(container_status "$container_id")"
      state="${status%% *}"
      health="${status##* }"
      if [[ "$state" == "running" && "$health" == "healthy" ]]; then
        log "Service $service is healthy."
        return 0
      fi
      log "Waiting for $service health. state=$state health=$health attempt=$attempt/40"
    else
      log "Waiting for $service container. attempt=$attempt/40"
    fi
    sleep 5
  done

  log "Recent logs for failed service $service:"
  APP_ENV_FILE="$ENV_FILE" docker compose "${COMPOSE_ARGS[@]}" logs --tail=80 "$service" || true
  die "Service $service did not become healthy."
}

check_container_health() {
  local services=(postgres redis api worker web)
  local service

  for service in "${services[@]}"; do
    wait_for_service_health "$service"
  done
}

curl_check() {
  local url="$1"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: curl -fsS --max-time 20 $url"
    return 0
  fi

  curl -fsS --max-time 20 "$url" >/dev/null
  log "Smoke OK: $url"
}

check_internal_endpoints() {
  curl_check "http://127.0.0.1:${API_PORT}/api/v1/health"
  curl_check "http://127.0.0.1:${WEB_PORT}"
}

write_nginx_config() {
  local tmp backup current_target

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: write Nginx server block to $NGINX_AVAILABLE and enable symlink $NGINX_ENABLED"
    return 0
  fi

  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

  if [[ -e "$NGINX_AVAILABLE" ]]; then
    backup="${NGINX_AVAILABLE}.bak.$(date -u +%Y%m%dT%H%M%SZ)"
    run_cmd cp -a "$NGINX_AVAILABLE" "$backup"
    LAST_NGINX_BACKUP="$backup"
    if ! confirm "Overwrite existing $NGINX_AVAILABLE? Backup: $backup"; then
      log "Nginx config overwrite declined; leaving existing JIMPITAN config unchanged."
      return 1
    fi
  fi

  tmp="$(mktemp)"
  cat > "$tmp" <<NGINX
# Purpose: Host Nginx server block for JIMPITAN web/API loopback proxy.
# Caller: scripts/install-vps.sh and VPS Nginx runtime.
# Deps: JIMPITAN web on 127.0.0.1:${WEB_PORT}, JIMPITAN API on 127.0.0.1:${API_PORT}.
# MainFuncs: Proxies / to web and /api/ to API with forwarded headers and request size limits.
# SideEffects: Routes public traffic for ${DOMAIN} to JIMPITAN upstreams.

server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size ${CLIENT_MAX_BODY_SIZE};

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Request-Id \$request_id;
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Request-Id \$request_id;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 5s;
        proxy_read_timeout 60s;
    }
}
NGINX

  install -m 0644 "$tmp" "$NGINX_AVAILABLE"
  rm -f "$tmp"

  if [[ -L "$NGINX_ENABLED" ]]; then
    current_target="$(readlink "$NGINX_ENABLED")"
    if [[ "$current_target" != "$NGINX_AVAILABLE" ]]; then
      if ! confirm "Replace existing symlink $NGINX_ENABLED -> $current_target?"; then
        die "Cannot enable JIMPITAN Nginx config without symlink confirmation."
      fi
    fi
  elif [[ -e "$NGINX_ENABLED" ]]; then
    if ! confirm "Replace existing non-symlink $NGINX_ENABLED?"; then
      die "Cannot enable JIMPITAN Nginx config without replacing existing enabled file."
    fi
  fi

  ln -sfn "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  log "Wrote and enabled JIMPITAN Nginx server block."
}

configure_nginx_if_needed() {
  if [[ "$UPDATE_MODE" == "true" && -f "$NGINX_AVAILABLE" ]]; then
    log "Update mode: existing JIMPITAN Nginx config found; not recreating it."
    return 0
  fi

  if ! write_nginx_config; then
    return 0
  fi

  run_cmd nginx -t

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: would ask for confirmation before reloading Nginx."
    return 0
  fi

  if confirm "Reload Nginx now?"; then
    run_cmd systemctl reload nginx
    NGINX_RELOADED=true
  else
    log "Nginx reload declined. Public runtime smoke checks are skipped until Nginx is reloaded."
  fi
}

run_certbot() {
  local certbot_args=(certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)

  if [[ -n "$ADMIN_EMAIL" ]]; then
    certbot_args+=(--email "$ADMIN_EMAIL")
  else
    certbot_args+=(--register-unsafely-without-email)
  fi

  run_cmd "${certbot_args[@]}"
  run_cmd nginx -t
}

maybe_enable_ssl() {
  if [[ "$SSL_ENABLED" != "true" ]]; then
    log "SSL setup skipped."
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY-RUN: would use certbot for $DOMAIN, installing it first only after confirmation if missing."
    return 0
  fi

  if [[ "$NGINX_RELOADED" != "true" ]]; then
    log "SSL setup skipped because Nginx was not reloaded with the JIMPITAN server block."
    return 0
  fi

  if command -v certbot >/dev/null 2>&1; then
    run_certbot
    return 0
  fi

  log "certbot is not installed. Install command: apt-get update && apt-get install -y certbot python3-certbot-nginx"
  if confirm "Install certbot now with apt-get?"; then
    command -v apt-get >/dev/null 2>&1 || die "apt-get is not available. Install certbot manually, then rerun with --update."
    run_cmd apt-get update
    run_cmd apt-get install -y certbot python3-certbot-nginx
    run_certbot
  else
    SSL_ENABLED=false
    log "certbot install declined; HTTPS smoke checks skipped."
  fi
}

run_public_smoke_checks() {
  if [[ "$DRY_RUN" == "true" ]]; then
    curl_check "http://${DOMAIN}"
    curl_check "http://${DOMAIN}/api/v1/health"
    if [[ "$SSL_ENABLED" == "true" ]]; then
      curl_check "https://${DOMAIN}"
      curl_check "https://${DOMAIN}/api/v1/health"
    fi
    return 0
  fi

  if [[ "$NGINX_RELOADED" != "true" ]]; then
    log "Public smoke checks skipped because Nginx was not reloaded by this run."
    return 0
  fi

  curl_check "http://${DOMAIN}"
  curl_check "http://${DOMAIN}/api/v1/health"

  if [[ "$SSL_ENABLED" == "true" ]]; then
    curl_check "https://${DOMAIN}"
    curl_check "https://${DOMAIN}/api/v1/health"
  fi
}

print_next_steps() {
  cat <<EOF
Next steps:
- Review $LOG_FILE for the full action log.
- Confirm DNS for $DOMAIN points to this VPS before public smoke checks are considered authoritative.
- Replace BOT_TOKEN in $ENV_FILE before enabling Telegram delivery if the installer created a temporary disabled token.

Rollback:
- APP_ENV_FILE=$ENV_FILE docker compose -f $COMPOSE_PROD_FILE -f $COMPOSE_OVERRIDE_FILE --env-file $ENV_FILE down
- Restore the previous Nginx config backup if needed: cp <backup> $NGINX_AVAILABLE
- nginx -t && systemctl reload nginx
- No Docker volumes are deleted by the rollback command.
EOF

  if [[ -n "$LAST_NGINX_BACKUP" ]]; then
    log "Latest Nginx backup: $LAST_NGINX_BACKUP"
  fi
}

main() {
  parse_args "$@"
  require_root
  init_logging
  require_commands
  git_update_if_requested
  check_required_ports
  warn_public_port_ownership
  collect_inputs
  prepare_env_file
  ensure_compose_override
  validate_compose_config
  start_containers
  run_migrations
  check_container_health
  check_internal_endpoints
  configure_nginx_if_needed
  maybe_enable_ssl
  run_public_smoke_checks
  print_next_steps
  log "Installer finished."
}

main "$@"
