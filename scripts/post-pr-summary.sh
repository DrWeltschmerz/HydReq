#!/usr/bin/env bash
set -euo pipefail

# Post a PR comment with a HydReq summary generated from a report JSON.
# Requires GitHub CLI (`gh`) authenticated for the repo.
# Usage:
#   scripts/post-pr-summary.sh <pr-number-or-url> <report.json>

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <pr-number-or-url> <report.json>" >&2
  exit 2
fi

PR_REF="$1"
REPORT_JSON="$2"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Install GitHub CLI and authenticate (gh auth login)." >&2
  exit 2
fi

if [[ ! -f "$REPORT_JSON" ]]; then
  echo "Report not found: $REPORT_JSON" >&2
  exit 2
fi

TMP_BODY=$(mktemp)
trap 'rm -f "$TMP_BODY"' EXIT

scripts/pr-summary.sh "$REPORT_JSON" > "$TMP_BODY"

echo "Posting summary to PR: $PR_REF" >&2
# Create a regular comment on the PR
gh pr comment "$PR_REF" -F "$TMP_BODY"

echo "Done." >&2
