#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$ROOT_DIR"

echo "Building hydreq binary..."
go build -o bin/hydreq ./cmd/hydreq

mkdir -p reports
failures=()

# If enabled, set demo auth env vars so the auth suite isn't skipped.
# This is opt-in: export ENABLE_DEMO_AUTH=1 to include auth.yaml automatically.
if [[ "${ENABLE_DEMO_AUTH:-}" == "1" ]]; then
  export DEMO_BEARER="${DEMO_BEARER:-demo-token}"
  if [[ -z "${BASIC_B64:-}" ]]; then
    export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
  fi
fi

run_suite() {
  local suite="$1"
  local name
  name=$(basename "$suite" .yaml)
  printf "\n=== Running suite: %s ===\n" "$suite"
  local runner=(./bin/hydreq run -f "$suite" --workers 4 --report-json "reports/${name}.json" --report-junit "reports/${name}.xml")
  if command -v timeout >/dev/null 2>&1; then
    runner=(timeout 120s "${runner[@]}")
  fi
  if "${runner[@]}"; then
    echo "✅ ${suite}"
  else
    echo "❌ ${suite}"
    failures+=("$suite")
  fi
}

for suite in testdata/*.yaml; do
  case "$(basename "$suite")" in
    auth.yaml)
      if [[ -z "${DEMO_BEARER:-}" && -z "${BASIC_B64:-}" ]]; then
        echo "Skipping $suite (requires DEMO_BEARER or BASIC_B64)"; continue
      fi
      ;;
    postgres.yaml)
      if [[ -z "${PG_DSN:-}" ]]; then
        echo "Skipping $suite (PG_DSN not set)"; continue
      fi
      ;;
    sqlserver.yaml)
      if [[ -z "${MSSQL_DSN:-}" ]]; then
        echo "Skipping $suite (MSSQL_DSN not set)"; continue
      fi
      ;;
  esac
  run_suite "$suite"
done

if (( ${#failures[@]} )); then
  printf "\nSome suites failed:\n"; printf ' - %s\n' "${failures[@]}"; exit 1
else
  printf "\nAll example suites passed\n"
fi
