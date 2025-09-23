#!/usr/bin/env bash
set -euo pipefail

# Compose command detection (prefer docker compose)
COMPOSE=()
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
fi

# Always stop services when we're done (unless KEEP_SERVICES=1)
services_started=0
cleanup() {
	if [[ "${KEEP_SERVICES:-0}" != "1" && "$services_started" == "1" && ${#COMPOSE[@]} -gt 0 ]]; then
		echo "Shutting down compose services..."
		# Stop and remove containers and networks started by compose; keep volumes by default
		"${COMPOSE[@]}" down --remove-orphans || true
	fi
}
trap cleanup EXIT INT TERM

echo "Formatting (gofmt) check..."
fmt_out=$(gofmt -l . | grep -v "^$" || true)
if [[ -n "$fmt_out" ]]; then
	echo "The following files are not gofmt'ed:" >&2
	echo "$fmt_out" >&2
	exit 1
fi

echo "Running vet..."
go vet ./...

echo "Ensuring go.mod is tidy..."
cp go.mod go.mod.ci.bak
cp go.sum go.sum.ci.bak
go mod tidy
if ! diff -q go.mod go.mod.ci.bak >/dev/null || ! diff -q go.sum go.sum.ci.bak >/dev/null; then
	echo "go.mod/go.sum changed after 'go mod tidy'. Please run it locally and commit changes." >&2
	diff -u go.mod.ci.bak go.mod || true
	diff -u go.sum.ci.bak go.sum || true
	rm -f go.mod.ci.bak go.sum.ci.bak
	exit 1
fi
rm -f go.mod.ci.bak go.sum.ci.bak

echo "Running unit tests (race)..."
did_db_tests=0
go test -race ./...

if [[ "${SKIP_SERVICES:-0}" == "1" ]]; then
	echo "SKIP_SERVICES=1 set; skipping service-based integration tests"
elif [[ ${#COMPOSE[@]} -gt 0 ]]; then
	# Choose compose file (host networking can help on restricted environments)
	COMPOSE_FILE_ARG=(-f docker-compose.yml)
	if [[ "${HOST_NETWORK:-0}" == "1" ]]; then
	  COMPOSE_FILE_ARG=(-f docker-compose.hostnet.yml)
	  echo "HOST_NETWORK=1 set; using host networking compose file"
	fi
	echo "Starting compose services (httpbin, Postgres, MSSQL)..."
	set +e
	"${COMPOSE[@]}" "${COMPOSE_FILE_ARG[@]}" up -d
	up_rc=$?
	set -e
	if [[ $up_rc -ne 0 ]]; then
		echo "WARN: Failed to start compose services (rc=$up_rc). Skipping service-based integration tests."
	else
		services_started=1
	echo "Waiting for httpbin..."
		HTTPBIN_URL="http://localhost:8080"
		# In host-network mode, httpbin listens on port 80
		if [[ "${HOST_NETWORK:-0}" == "1" ]]; then
			HTTPBIN_URL="http://localhost"
		fi
	for i in {1..30}; do
		curl -sSf "${HTTPBIN_URL}/ip" >/dev/null && break || sleep 2
	done
	export HTTPBIN_BASE_URL="$HTTPBIN_URL"
	echo "Waiting for Postgres..."
	for i in {1..30}; do
		if [[ "${HOST_NETWORK:-0}" == "1" && $(command -v pg_isready) ]]; then
			pg_isready -U postgres -h localhost && break || sleep 2
		else
			docker exec $(docker ps -qf name=postgres) pg_isready -U postgres && break || sleep 2
		fi
	done
	export PG_DSN="postgres://postgres:password@localhost:5432/qa?sslmode=disable"
	echo "Waiting for MSSQL port..."
	for i in {1..30}; do
		(echo > /dev/tcp/127.0.0.1/1433) >/dev/null 2>&1 && break || sleep 2
	done
	export MSSQL_DSN="sqlserver://sa:Your_password123@localhost:1433?database=master"
		echo "Running integration tests (if enabled by DSNs)..."
		PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" go test -run "Test(PG|MSSQL)Integration" -v ./internal/runner || true
		did_db_tests=1
	echo "Running example suites against local httpbin (auth enabled)..."
		ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" HTTPBIN_BASE_URL="$HTTPBIN_BASE_URL" PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" ./scripts/run-examples.sh || true
	fi
else
		echo "docker or compose not available; skipping service-based integration tests"
	echo "Running example suites (DB examples will be skipped). You can set HTTPBIN_BASE_URL to target a local httpbin."
	ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" ./scripts/run-examples.sh || true
fi

if [[ "$did_db_tests" != "1" ]]; then
echo "Tip: To run DB integration tests, set environment variables and run targeted tests, e.g.:"
echo "  PG_DSN=postgres://user:pass@localhost:5432/db?sslmode=disable go test -run TestPG ./..."
echo "  MSSQL_DSN=sqlserver://sa:Your_password123@localhost:1433?database=master go test -run TestMSSQL ./..."
fi
