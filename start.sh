#!/bin/sh
set -eu

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker fehlt. Bitte Docker Desktop starten und das Skript erneut ausführen." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Der Docker-Dienst antwortet nicht. Bitte Docker Desktop starten." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Hinweis: keine .env gefunden. Compose nutzt die Standardwerte aus docker-compose.yml."
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm fehlt. Das Frontend kann nicht gebaut werden." >&2
  exit 1
fi

echo "Frontend bauen …"
(cd frontend && npm ci && npm run build)

echo "API, Datenbank, Redis, Wächter und Web starten …"
docker compose up -d --build

echo "Warte auf die API …"
ready=0
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "http://127.0.0.1:8000/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "Die API ist nicht gesund geworden. Logs: docker compose logs api" >&2
  exit 1
fi

echo "SoulMap läuft."
echo "Oberfläche: http://127.0.0.1:8080"
echo "API:        http://127.0.0.1:8000/health"
echo "Admin:      http://127.0.0.1:8080/admin"
