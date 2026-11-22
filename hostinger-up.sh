#!/usr/bin/env bash
# SoulMap auf einem Hostinger-VPS starten.
#
# Einmalig auf dem Server (als root oder mit sudo):
#   curl -fsSL https://raw.githubusercontent.com/ankuba-code/mysoulmap/main/hostinger-up.sh -o /tmp/hostinger-up.sh
#   bash /tmp/hostinger-up.sh
#
# Danach reicht:
#   /opt/mysoulmap/hostinger-up.sh
#
# Vor dem ersten Start /opt/mysoulmap/.env anlegen (siehe .env.example).
# Die Datei wird von git nicht überschrieben.
#
# Privates Repository: Deploy-Key für git@github.com:ankuba-code/mysoulmap.git
# oder REPO_URL mit einem Token setzen.
# Private GHCR-Images: GHCR_USER und GHCR_TOKEN setzen (Classic-PAT mit read:packages).

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mysoulmap}"
REPO_URL="${REPO_URL:-git@github.com:ankuba-code/mysoulmap.git}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"

if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  SUDO="sudo"
fi

log() {
  printf '%s\n' "$*"
}

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_packages() {
  if need_cmd apt-get; then
    $SUDO apt-get update
    $SUDO apt-get install -y ca-certificates curl git
  elif ! need_cmd git || ! need_cmd curl; then
    die "git und curl fehlen, und apt-get ist nicht verfügbar."
  fi
}

install_docker() {
  if need_cmd docker && docker compose version >/dev/null 2>&1; then
    return 0
  fi
  log "Docker wird installiert …"
  if ! need_cmd curl; then
    install_packages
  fi
  curl -fsSL https://get.docker.com | $SUDO sh
  if [ "$(id -u)" -ne 0 ]; then
    $SUDO usermod -aG docker "$USER" || true
  fi
  need_cmd docker || die "Docker ist nach der Installation nicht im PATH."
  docker compose version >/dev/null 2>&1 || die "Das Docker-Compose-Plugin fehlt."
}

start_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  log "Docker-Dienst wird gestartet …"
  if need_cmd systemctl; then
    $SUDO systemctl enable --now docker
  elif need_cmd service; then
    $SUDO service docker start
  else
    die "Der Docker-Dienst antwortet nicht und es gibt kein systemctl."
  fi
  i=0
  while [ "$i" -lt 30 ]; do
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  die "Docker läuft nicht. Falls der User gerade zur Gruppe docker hinzugefügt wurde: neu einloggen und das Skript erneut starten."
}

update_repo() {
  install_packages
  if [ ! -d "$APP_DIR/.git" ]; then
    if [ -e "$APP_DIR" ] && [ -n "$(ls -A "$APP_DIR" 2>/dev/null || true)" ]; then
      die "$APP_DIR existiert, ist aber kein Git-Repository. Verzeichnis leeren oder APP_DIR setzen."
    fi
    log "Repository wird geklont …"
    $SUDO mkdir -p "$(dirname "$APP_DIR")"
    $SUDO chown "$(id -u):$(id -g)" "$(dirname "$APP_DIR")"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  log "Repository wird von GitHub geholt …"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
}

login_ghcr() {
  if [ -z "${GHCR_USER:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
    return 0
  fi
  log "Anmeldung bei ghcr.io …"
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
}

wait_healthy() {
  log "Warte auf $HEALTH_URL …"
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  log "Die Oberfläche antwortet noch nicht. Logs: docker compose -f $COMPOSE_FILE logs --tail 80" >&2
  return 1
}

install_docker
start_docker
update_repo

if [ "${HOSTINGER_UP_REEXEC:-}" != 1 ]; then
  export HOSTINGER_UP_REEXEC=1
  exec "$APP_DIR/hostinger-up.sh"
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  die "Keine .env in $APP_DIR. Werte aus .env.example übernehmen und das Skript erneut starten."
fi

if [ ! -f backend/data/GeoLite2-Country.mmdb ]; then
  log "Hinweis: backend/data/GeoLite2-Country.mmdb fehlt. GeoIP bleibt leer, der Start geht weiter."
fi

login_ghcr

log "Images von GitHub ziehen und Container starten …"
docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

if wait_healthy; then
  log "SoulMap läuft."
  log "Oberfläche (lokal auf dem VPS): http://127.0.0.1:8080"
  log "Health: $HEALTH_URL"
else
  exit 1
fi
