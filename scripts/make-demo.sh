#!/usr/bin/env bash
set -euo pipefail

# Convert an existing demo .webm video to a GIF at docs/screenshots/demo.gif.
# This does NOT run Playwright or start any services. It simply converts a file you already recorded.
#
# Usage:
#   scripts/make-demo.sh [input.webm] [output.gif]
# Defaults:
#   - input: newest docs/screenshots/*.webm (fallback: newest test/e2e/test-results/**/video.*)
#   - output: docs/screenshots/demo.gif

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

INPUT_WEBM=${1:-}
OUTPUT_GIF=${2:-docs/screenshots/demo.gif}

mkdir -p docs/screenshots

if [[ -z "$INPUT_WEBM" ]]; then
  echo "==> Selecting input video (.webm)"
  set +e
  # Prefer a video you placed under docs/screenshots
  INPUT_WEBM=$(find docs/screenshots -maxdepth 1 -type f -name '*.webm' -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | awk '{ $1=""; sub(/^ /, ""); print }')
  if [[ -z "$INPUT_WEBM" ]]; then
    # Fallback to the latest Playwright video artifact
    INPUT_WEBM=$(find test/e2e/test-results -type f \( -name 'video.*' -o -name '*video.*' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | awk '{ $1=""; sub(/^ /, ""); print }')
  fi
  set -e
fi

if [[ -z "${INPUT_WEBM:-}" || ! -f "$INPUT_WEBM" ]]; then
  echo "ERROR: Could not find an input .webm file to convert." >&2
  echo "Hint: Provide it explicitly or place one under docs/screenshots/." >&2
  echo "Example: scripts/make-demo.sh docs/screenshots/demo.webm" >&2
  exit 1
fi

echo "==> Converting '$INPUT_WEBM' -> '$OUTPUT_GIF'"

PALETTE="docs/screenshots/palette.png"

# Use dockerized ffmpeg to avoid local install
docker run --rm -v "$PWD:/work" jrottenberg/ffmpeg:4.4-alpine \
  -y -i "/work/$INPUT_WEBM" -vf "fps=24,scale=960:-1:flags=lanczos,palettegen" \
  "/work/$PALETTE"

docker run --rm -v "$PWD:/work" jrottenberg/ffmpeg:4.4-alpine \
  -y -i "/work/$INPUT_WEBM" -i "/work/$PALETTE" \
  -filter_complex "fps=24,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a" \
  "/work/$OUTPUT_GIF"

GIF_SIZE=$(stat -c %s "$OUTPUT_GIF" 2>/dev/null || stat -f %z "$OUTPUT_GIF" 2>/dev/null || echo 0)
echo "==> GIF written: $OUTPUT_GIF ($GIF_SIZE bytes)"

echo "Done. README already references docs/screenshots/demo.gif"
