#!/usr/bin/env bash
set -euo pipefail

# Discover and run user suites, write reports, and generate PR summaries.
# Works from a release archive or repo checkout.
#
# Usage:
#   scripts/run-suites.sh [SUITES_GLOB...]
# Defaults to testdata/*.yaml if no globs provided.
#
# Outputs:
#   - Per-suite reports: reports/<suite>.{json,xml}
#   - Batch summary markdown: reports/PR_SUMMARY_ALL.md
#
# Optional:
#   - Set GH_PR_REF to a PR number/URL to auto-comment via GitHub CLI (`gh`).
#   - Set ENABLE_DEMO_AUTH=1 to include auth examples requiring DEMO_BEARER/BASIC_B64.

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$ROOT_DIR"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required" >&2
  exit 2
fi

mkdir -p reports

# Resolve suite list
suites=("$@")
if (( ${#suites[@]} == 0 )); then
  shopt -s nullglob
  suites=(testdata/*.yaml)
  shopt -u nullglob
fi

failures=()
run_suite() {
  local suite="$1"
  local name
  name=$(basename "$suite" .yaml)
  printf "\n=== Running suite: %s ===\n" "$suite"
  local runner=(./hydreq run -f "$suite" --workers 4 --report-json "reports/${name}.json" --report-junit "reports/${name}.xml")
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

# Optional demo auth
if [[ "${ENABLE_DEMO_AUTH:-}" == "1" ]]; then
  export DEMO_BEARER="${DEMO_BEARER:-demo-token}"
  if [[ -z "${BASIC_B64:-}" ]]; then
    export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
  fi
fi

# Filter suites that require env if not present
filtered=()
for suite in "${suites[@]}"; do
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
  filtered+=("$suite")
  run_suite "$suite"
done

# Batch PR summary across all JSONs
if ls -1 ./reports/*.json >/dev/null 2>&1; then
  scripts/pr-summary-batch.sh ./reports | tee ./reports/PR_SUMMARY_ALL.md
  echo "Wrote batch summary to ./reports/PR_SUMMARY_ALL.md"

  # Also generate per-latest summary for convenience
  latest_report=$(ls -t ./reports/*.json | head -n1)
  {
    scripts/pr-summary.sh "$latest_report" || true
    echo
    echo "#### Suggested assertions"
    scripts/suggest-assertions.sh ./reports || true
  } | tee ./reports/PR_SUMMARY.md
  echo "Wrote latest summary to ./reports/PR_SUMMARY.md"

  if [[ -n "${GH_PR_REF:-}" ]] && command -v gh >/dev/null 2>&1; then
    echo "Posting latest summary to PR: $GH_PR_REF"
    scripts/post-pr-summary.sh "$GH_PR_REF" "$latest_report" || echo "WARN: Failed to post summary (continuing)"
  fi
else
  echo "No JSON reports found; nothing to summarize"
fi

if (( ${#failures[@]} )); then
  printf "\nSome suites failed:\n"; printf ' - %s\n' "${failures[@]}"; exit 1
else
  printf "\nAll suites passed\n"
fi
