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


# Optional demo auth
if [[ "${ENABLE_DEMO_AUTH:-}" == "1" ]]; then
  export DEMO_BEARER="${DEMO_BEARER:-demo-token}"
  if [[ -z "${BASIC_B64:-}" ]]; then
    export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
  fi
fi

# Run all suites in batch mode (single run command)
if command -v timeout >/dev/null 2>&1; then
  timeout 300s ./bin/hydreq run --workers 4 --report-dir reports
else
  ./bin/hydreq run --workers 4 --report-dir reports
fi

# Batch PR summary from batch run report
batch_report=$(ls -1t ./reports/run-*.json 2>/dev/null | head -n1 || true)
if [[ -n "$batch_report" && -f "$batch_report" ]]; then
  scripts/pr-summary.sh "$batch_report" | tee ./reports/PR_SUMMARY_ALL.md
  echo "Wrote batch summary to ./reports/PR_SUMMARY_ALL.md"

  # Also generate per-latest summary for convenience
  latest_report=$(ls -t ./reports/*.json | grep -v '/run-' | head -n1)
  if [[ -n "$latest_report" && -f "$latest_report" ]]; then
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
  fi
else
  echo "No batch run report found; nothing to summarize"
fi

printf "\nArtifacts under ./reports (per-suite + run-<ts>.json/xml/html).\n"
if [[ -n "$batch_report" ]]; then
  ts=$(basename "$batch_report" | sed 's/run-\(.*\)\.json/\1/')
  # List per-suite artifacts from this run
  ls -1 reports/*-"$ts".* 2>/dev/null | grep -v "run-$ts" | sort | uniq | while read -r artifact; do
    echo "Suite artifact: $artifact"
  done
  # Batch artifacts
  ls -1 reports/run-"$ts".* 2>/dev/null | sort | uniq | while read -r artifact; do
    echo "Batch artifact: $artifact"
  done
fi

if (( ${#failures[@]} )); then
  printf "\nSome suites failed:\n"; printf ' - %s\n' "${failures[@]}"; exit 1
else
  printf "\nAll suites passed\n"
fi
