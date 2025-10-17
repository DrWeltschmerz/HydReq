#!/usr/bin/env bash
set -euo pipefail

if [[ ${VERBOSE:-0} == 1 ]]; then
  set -x
fi

COMPOSE_FILE=docker-compose.playwright.yml

cleanup(){
  echo "Shutting down services..."
  docker compose -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

SNAPSHOT_FLAG=""
if [[ ${UPDATE_SNAPSHOTS:-0} == 1 ]]; then
  SNAPSHOT_FLAG="--update-snapshots"
fi

echo "Demo projects: ${DEMO_PROJECTS:-demo-chrome}"

echo "Building hydreq binary..."
go build -o ./bin/hydreq ./cmd/hydreq

echo "Starting services via docker-compose ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans httpbin hydreq

wait_for_http(){
  local service=$1
  local url=$2
  local timeout=${3:-60}
  echo "Waiting for $service at $url..."
  for ((i=1; i<=timeout; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$service is ready"
      return 0
    fi
    sleep 2
  done
  echo "ERROR: $service did not become ready at $url" >&2
  docker compose -f "$COMPOSE_FILE" logs --tail=200 "$service" || true
  exit 1
}

wait_for_http "httpbin" "http://localhost:8080/ip"
wait_for_http "hydreq" "http://localhost:8787/"

echo "Running Playwright container to execute tests..."
docker compose -f "$COMPOSE_FILE" run --rm \
  -e UPDATE_SNAPSHOTS=${UPDATE_SNAPSHOTS:-0} \
  -e SNAPSHOT_FLAG="$SNAPSHOT_FLAG" \
  -e VERBOSE=${VERBOSE:-0} \
  -e DEMO_PROJECTS="${DEMO_PROJECTS:-demo-chrome}" \
  -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-1} \
  -e PLAYWRIGHT_INSTALL_DEPS=${PLAYWRIGHT_INSTALL_DEPS:-0} \
  -e PLAYWRIGHT_HEADLESS=${PLAYWRIGHT_HEADLESS:-1} \
  -e PLAYWRIGHT_DISABLE_XVFB=${PLAYWRIGHT_DISABLE_XVFB:-0} \
  -e PLAYWRIGHT_XVFB_SERVER_ARGS="${PLAYWRIGHT_XVFB_SERVER_ARGS:-}" \
  -e PLAYWRIGHT_WORKERS="${PLAYWRIGHT_WORKERS:-}" \
  -e DEBUG=${DEBUG:-} \
  -e PWDEBUG=${PWDEBUG:-} \
  --entrypoint /bin/bash playwright -lc '
  set -euo pipefail
  if [[ ${VERBOSE:-0} == 1 ]]; then
    set -x
  fi
  cd /work/test/e2e
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
  if [[ ${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-0} == 1 ]]; then
    echo "Skipping Playwright browser install (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)"
  else
    echo "Installing Playwright browsers (chrome, firefox) with dependencies..."
    npx playwright install --with-deps chrome firefox
  fi
  if [[ ${PLAYWRIGHT_INSTALL_DEPS:-0} == 1 ]]; then
    echo "Force installing Playwright system dependencies (PLAYWRIGHT_INSTALL_DEPS=1)"
    npx playwright install-deps
  fi
  declare -a extra_flags=()
  if [ -n "${SNAPSHOT_FLAG:-}" ]; then
    extra_flags+=("${SNAPSHOT_FLAG}")
  fi
  if [[ ${PLAYWRIGHT_HEADLESS:-1} == 0 ]]; then
    extra_flags+=("--headed")
    if [[ -z ${PWDEBUG:-} ]]; then
      PWDEBUG="console"
    fi
  fi
  if [ -n "${PLAYWRIGHT_WORKERS:-}" ]; then
    extra_flags+=("--workers=${PLAYWRIGHT_WORKERS}")
  fi
  IFS=',' read -ra DEMO_PROJECT_LIST <<< "${DEMO_PROJECTS:-demo-chrome}"
  PLAYWRIGHT_PROJECT_ARGS=()
  for raw in "${DEMO_PROJECT_LIST[@]}"; do
    name=$(echo "$raw" | xargs)
    if [ -n "$name" ]; then
      PLAYWRIGHT_PROJECT_ARGS+=("--project=$name")
    fi
  done
  if [ ${#PLAYWRIGHT_PROJECT_ARGS[@]} -eq 0 ]; then
    PLAYWRIGHT_PROJECT_ARGS=("--project=demo-chrome")
  fi
  echo "Running demo showcase for projects: ${PLAYWRIGHT_PROJECT_ARGS[*]}"
  echo "DEBUG=${DEBUG:-<empty>}"
  echo "PWDEBUG=${PWDEBUG:-<empty>}"
  echo "PLAYWRIGHT_HEADLESS=${PLAYWRIGHT_HEADLESS:-1}"
  echo "PLAYWRIGHT_DISABLE_XVFB=${PLAYWRIGHT_DISABLE_XVFB:-0}"
  declare -a cmd=(npx playwright test tests/demo-showcase.spec.ts "${PLAYWRIGHT_PROJECT_ARGS[@]}" --reporter=list --reporter=html)
  if [ ${#extra_flags[@]} -gt 0 ]; then
    cmd+=("${extra_flags[@]}")
  fi
  declare -a runner=()
  if [[ ${PLAYWRIGHT_DISABLE_XVFB:-0} != 1 ]]; then
    echo "Launching Xvfb..."
    runner=(Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp)
    "${runner[@]}" &
    XVFB_PID=$!
    trap 'kill $XVFB_PID >/dev/null 2>&1 || true' EXIT
    sleep 1
    export DISPLAY=:99
    echo "DISPLAY set to $DISPLAY"
  else
    echo "Xvfb disabled; using host display"
  fi
  echo "Executing: ${cmd[*]}"
  DEMO=1 UPDATE_SNAPSHOTS=${UPDATE_SNAPSHOTS:-0} HYDREQ_E2E_URL=${HYDREQ_E2E_URL:-http://hydreq:8787/} HTTPBIN_BASE_URL=${HTTPBIN_BASE_URL:-http://httpbin} \
    DEBUG="${DEBUG:-}" PWDEBUG="${PWDEBUG:-}" \
    "${cmd[@]}"
'

echo "Playwright demo run complete"

if [[ ${CAPTURE_MEDIA:-0} == 1 ]]; then
  echo "Collecting demo artifacts..."
  DEST_BASE=${CAPTURE_DIR:-docs/screenshots/latest_demo}
  mkdir -p "$DEST_BASE"

  IFS=',' read -ra DEMO_PROJECT_LIST <<< "${DEMO_PROJECTS:-demo-chrome}"
  if [[ ${#DEMO_PROJECT_LIST[@]} -eq 0 ]]; then
    DEMO_PROJECT_LIST=("demo-chrome")
  fi
  PREFERRED=${PREFERRED_PROJECT:-$(echo "${DEMO_PROJECT_LIST[0]}" | xargs)}

  FOUND_ANY=0
  for raw in "${DEMO_PROJECT_LIST[@]}"; do
    project=$(echo "$raw" | xargs)
    [[ -z "$project" ]] && continue
    set +e
    PROJECT_DIR=$(ls -td test/e2e/test-results/*"$project"*/ 2>/dev/null | head -n1)
    set -e
    if [[ -z "$PROJECT_DIR" ]]; then
      echo "WARN: No test results found for project $project" >&2
      continue
    fi
    FOUND_ANY=1
    DEST="$DEST_BASE/$project"
    mkdir -p "$DEST"
    find "$DEST" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    cp -a "$PROJECT_DIR"/. "$DEST"/
    echo "Copied Playwright artifacts for $project to $DEST"

    if [[ "$project" == "$PREFERRED" && -f "$DEST/video.webm" ]]; then
      mkdir -p docs/screenshots
      cp -f "$DEST/video.webm" docs/screenshots/demo.webm
      echo "Updated docs/screenshots/demo.webm from $project"
      if [[ ${EXPORT_GIF:-1} == 1 ]]; then
        if command -v node >/dev/null 2>&1; then
          if ! node test/e2e/scripts/webm-to-gif.js docs/screenshots/demo.webm docs/screenshots/demo.gif; then
            echo "WARN: GIF conversion failed" >&2
          else
            echo "Updated docs/screenshots/demo.gif"
          fi
        else
          echo "Node runtime not found; skipping GIF conversion" >&2
        fi
      fi
    fi

    if [[ ${EXPORT_SCREENSHOT:-1} == 1 ]]; then
      set +e
      FIRST_SHOT=$(find "$DEST" -maxdepth 1 -type f -name '*.png' | sort | head -n1)
      set -e
      if [[ -n "$FIRST_SHOT" ]]; then
        TARGET="docs/screenshots/${project}-demo.png"
        mkdir -p docs/screenshots
        cp -f "$FIRST_SHOT" "$TARGET"
        echo "Updated $TARGET"
        if [[ "$project" == "$PREFERRED" ]]; then
          cp -f "$FIRST_SHOT" docs/screenshots/demo-editor-running-demo-linux.png
          echo "Updated docs/screenshots/demo-editor-running-demo-linux.png"
        fi
      fi
    fi
  done

  if [[ $FOUND_ANY -eq 0 ]]; then
    echo "No demo result directory found; skipping capture." >&2
  fi
fi
