#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$ROOT_DIR"

echo "Building hydreq binary..."
go build -o bin/hydreq ./cmd/hydreq

mkdir -p reports

# Default env so all suites pass locally
export HTTPBIN_BASE_URL="${HTTPBIN_BASE_URL:-http://localhost:8080}"
export DEMO_BEARER="${DEMO_BEARER:-demo-token}"
if [[ -z "${BASIC_B64:-}" ]]; then
	export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
fi
# Local DB DSNs (override from shell if needed)
export PG_DSN="${PG_DSN:-postgres://postgres:password@localhost:5432/qa?sslmode=disable}"
export MSSQL_DSN="${MSSQL_DSN:-sqlserver://sa:Your_password123@localhost:1433?database=master}"

# Optional: start compose services (httpbin/postgres/mssql) and wait
if [[ "${START_SERVICES:-0}" == "1" ]]; then
	if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
		echo "Starting compose services..."
		docker compose -f docker-compose.yml up -d || true
		echo "Waiting for httpbin at $HTTPBIN_BASE_URL..."
		for i in {1..30}; do curl -sf "$HTTPBIN_BASE_URL/ip" >/dev/null && break || sleep 2; done
		echo "Waiting for Postgres..."; for i in {1..30}; do (echo > /dev/tcp/127.0.0.1/5432) >/dev/null 2>&1 && break || sleep 2; done
		echo "Waiting for MSSQL...";   for i in {1..30}; do (echo > /dev/tcp/127.0.0.1/1433) >/dev/null 2>&1 && break || sleep 2; done
		started=1
	fi
fi


# Run all suites in batch mode (single run command)
if command -v timeout >/dev/null 2>&1; then
	timeout 300s ./bin/hydreq run --workers 4 --report-dir reports
else
	./bin/hydreq run --workers 4 --report-dir reports
fi

if [[ "${START_SERVICES:-0}" == "1" && "${KEEP_SERVICES:-0}" != "1" ]]; then
	echo "Stopping compose services..."
	docker compose -f docker-compose.yml down --remove-orphans || true
fi

printf "\nArtifacts under ./reports (per-suite + run-<ts>.html/json/xml).\n"
# Batch report last, bold and blue
last_run_html=$(ls -1t reports/run-*.html 2>/dev/null | head -n1 || true)
if [[ -n "${last_run_html}" ]]; then
  ts=$(basename "$last_run_html" | sed 's/run-\(.*\)\.html/\1/')
  # List per-suite reports from this run
  ls -1 reports/*-"$ts".html 2>/dev/null | grep -v "run-$ts" | while read -r suite_html; do
    echo "Suite report: $suite_html"
  done
  echo -e "\033[1;34mBatch report: ${last_run_html}\033[0m"
fi

