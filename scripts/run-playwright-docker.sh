#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=docker-compose.playwright.yml

echo "Building hydreq binary..."
go build -o ./bin/hydreq ./cmd/hydreq

echo "Starting services via docker-compose ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "Waiting for httpbin to be healthy..."
for i in {1..60}; do
  docker compose -f "$COMPOSE_FILE" exec -T httpbin curl -fsS http://localhost:80/ip >/dev/null 2>&1 && break || sleep 2
done

echo "Running Playwright container to execute tests..."
docker compose -f "$COMPOSE_FILE" run --rm playwright bash -lc '
  set -euo pipefail
  cd /work
  # Ensure test/e2e has dependencies
  if [ -f /work/test/e2e/package.json ]; then
    cd /work/test/e2e
    npm ci || npm install
    npx playwright install --with-deps
    HYDREQ_E2E_URL=${HYDREQ_E2E_URL:-http://host.docker.internal:8080/} npx playwright test --reporter=list || true
  else
    echo "No test/e2e/package.json found; nothing to run"
  fi
'

echo "Shutting down services..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

echo "Done"
