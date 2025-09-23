#!/usr/bin/env bash
set -euo pipefail

# Suggest simple assertions from the latest report JSON in a directory (default: ./reports)
# Usage: scripts/suggest-assertions.sh [REPORTS_DIR]

REPORTS_DIR=${1:-./reports}
latest=$(ls -t "$REPORTS_DIR"/*.json 2>/dev/null | head -n1 || true)
if [[ -z "${latest}" ]]; then
  echo "No report JSON found in $REPORTS_DIR" >&2
  exit 1
fi

echo "Reading: $latest" >&2

# For now, we output a basic checklist per test with a placeholder assertion block.
# Future: parse per-test response bodies to propose jsonEquals/jsonContains.
jq -r '
  .suites[] | .tests[] |
  "- [ ] \(.name): add/confirm assertions (e.g.)\n    assert:\n      status: 200\n      maxDurationMs: \(.durationMs // 500)\n"
' "$latest"
