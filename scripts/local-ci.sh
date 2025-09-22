#!/usr/bin/env bash
set -euo pipefail

echo "Running unit tests..."
did_db_tests=0
go test ./...

if command -v docker >/dev/null 2>&1 && command -v docker-compose >/dev/null 2>&1; then
	echo "Starting docker-compose services (httpbin, Postgres, MSSQL)..."
	docker-compose up -d
	echo "Waiting for httpbin..."
	for i in {1..30}; do
		curl -sSf http://localhost:8080/ip >/dev/null && break || sleep 2
	done
	export HTTPBIN_BASE_URL="http://localhost:8080"
	echo "Waiting for Postgres..."
	for i in {1..30}; do
		docker exec $(docker ps -qf name=postgres) pg_isready -U postgres && break || sleep 2
	done
	export PG_DSN="postgres://postgres:password@localhost:5432/qa?sslmode=disable"
	echo "Waiting for MSSQL port..."
	for i in {1..30}; do
		(echo > /dev/tcp/127.0.0.1/1433) >/dev/null 2>&1 && break || sleep 2
	done
	export MSSQL_DSN="sqlserver://sa:Your_password123@localhost:1433?database=master"
		echo "Running integration tests (if enabled by DSNs)..."
		PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" go test -run "Test(PG|MSSQL)Integration" -v ./internal/runner
		did_db_tests=1
	echo "Running example suites against local httpbin (auth enabled)..."
		ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" HTTPBIN_BASE_URL="$HTTPBIN_BASE_URL" PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" ./scripts/run-examples.sh || true
else
		echo "docker or docker-compose not available; skipping service-based integration tests"
	echo "Running example suites (DB examples will be skipped). You can set HTTPBIN_BASE_URL to target a local httpbin."
	ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" ./scripts/run-examples.sh || true
fi

if [[ "$did_db_tests" != "1" ]]; then
echo "Tip: To run DB integration tests, set environment variables and run targeted tests, e.g.:"
echo "  PG_DSN=postgres://user:pass@localhost:5432/db?sslmode=disable go test -run TestPG ./..."
echo "  MSSQL_DSN=sqlserver://sa:Your_password123@localhost:1433?database=master go test -run TestMSSQL ./..."
fi
