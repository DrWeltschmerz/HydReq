#!/usr/bin/env bash
set -euo pipefail

# Compare two HydReq report JSON files and print a brief delta summary.
# Usage:
#   scripts/compare-reports.sh <old.json> <new.json>

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <old.json> <new.json>" >&2
  exit 2
fi

OLD="$1"
NEW="$2"

if [[ ! -f "$OLD" || ! -f "$NEW" ]]; then
  echo "Both files must exist." >&2
  exit 2
fi

echo "### Delta summary"

echo "- Suites: $(jq -r '.suite' "$OLD") -> $(jq -r '.suite' "$NEW")"

echo "- Total: $(jq -r '.summary.total' "$OLD") -> $(jq -r '.summary.total' "$NEW")"

echo "- Passed: $(jq -r '.summary.passed' "$OLD") -> $(jq -r '.summary.passed' "$NEW")"

echo "- Failed: $(jq -r '.summary.failed' "$OLD") -> $(jq -r '.summary.failed' "$NEW")"

echo "- Skipped: $(jq -r '.summary.skipped' "$OLD") -> $(jq -r '.summary.skipped' "$NEW")"

echo

echo "#### Test status changes"
# Show tests that changed status between reports
jq -n --argfile A "$OLD" --argfile B "$NEW" '
  def idx(xs): reduce xs[] as $x ({}; .[$x.name] = $x.status);
  def status_changes(a; b):
    (idx(a.tests) as $ia | idx(b.tests) as $ib |
      ($ia + $ib | keys) as $names |
      $names
      | map({ name: ., old: ($ia[.] // "?"), new: ($ib[.] // "?") })
      | map(select(.old != .new)))
  ;
  status_changes($A; $B)[] | "- \(.name): \(.old) -> \(.new)"
'
