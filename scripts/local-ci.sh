#!/usr/bin/env bash
set -euo pipefail

# Color definitions for uniform styling
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper function for section headers
section() {
    echo -e "\n${BOLD}${BLUE}========================================${NC}"
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo -e "${BOLD}${BLUE}========================================${NC}\n"
}

# Helper function for subsection headers
subsection() {
    echo -e "${BOLD}${BLUE}--- $1 ---${NC}"
}

# Default to non-host networking; force non-host on GitHub CI for portability
HOST_NETWORK="${HOST_NETWORK:-0}"
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
	HOST_NETWORK=0
fi

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
		subsection "Shutting down compose services"
		"${COMPOSE[@]}" down --remove-orphans || true
	fi
}
trap cleanup EXIT INT TERM

section "Code Quality Checks"

subsection "Formatting (gofmt)"
fmt_out=$(gofmt -l . | grep -v "^$" || true)
if [[ -n "$fmt_out" ]]; then
	echo -e "${RED}✗ The following files are not gofmt'ed:${NC}" >&2
	echo "$fmt_out" >&2
	exit 1
else
	echo -e "${GREEN}✓ Formatting check passed${NC}"
fi

subsection "Running go vet"
go vet ./...
echo -e "${GREEN}✓ Vet check passed${NC}"

if [[ "${SKIP_VALIDATION:-0}" == "1" ]]; then
	echo -e "${YELLOW}⚠ Skipping suite validation (SKIP_VALIDATION=1)${NC}"
else
	subsection "Validating example suites against schema"
	if [[ ! -x bin/validate ]]; then
		go build -o bin/validate ./cmd/validate
	fi
	if ./bin/validate -dir testdata -schema schemas/suite.schema.json -quiet; then
		echo -e "${GREEN}✓ Schema validation passed${NC}"
	else
		if [[ "${VALIDATION_WARN_ONLY:-0}" == "1" ]]; then
			echo -e "${YELLOW}⚠ WARN: validation failed but continuing (VALIDATION_WARN_ONLY=1)${NC}" >&2
		else
			echo -e "${RED}✗ Schema validation failed${NC}" >&2
			exit 1
		fi
	fi
fi

subsection "Ensuring go.mod is tidy"
cp go.mod go.mod.ci.bak
cp go.sum go.sum.ci.bak
go mod tidy
if ! diff -q go.mod go.mod.ci.bak >/dev/null || ! diff -q go.sum go.sum.ci.bak >/dev/null; then
	echo -e "${RED}✗ go.mod/go.sum changed after 'go mod tidy'. Please run it locally and commit changes.${NC}" >&2
	diff -u go.mod.ci.bak go.mod || true
	diff -u go.sum.ci.bak go.sum || true
	rm -f go.mod.ci.bak go.sum.ci.bak
	exit 1
else
	echo -e "${GREEN}✓ go.mod is tidy${NC}"
	rm -f go.mod.ci.bak go.sum.ci.bak
fi

section "Unit Tests"

subsection "Running unit tests (race)"
did_db_tests=0
go test -race ./...

section "Web UI Tests"

if command -v npm >/dev/null 2>&1; then
	subsection "Installing npm dependencies"
	if [[ ! -d node_modules ]]; then
		npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1
	else
		npm install >/dev/null 2>&1
	fi

	subsection "Running JS unit tests (mocha)"
	npm run test:js
else
	echo -e "${YELLOW}⚠ npm not found; skipping JS unit tests${NC}"
fi

if [[ "${SKIP_SERVICES:-0}" == "1" ]]; then
	echo -e "${YELLOW}⚠ SKIP_SERVICES=1 set; skipping service-based integration tests${NC}"
elif [[ ${#COMPOSE[@]} -gt 0 ]]; then
	section "Integration Tests"

	    subsection "Starting compose services"
	    # Build compose file list: always include base, optionally hostnet and nopublish override
	    COMPOSE_FILES=(-f docker-compose.yml)
        COMPOSE_UP_FLAGS=(up -d --build)
	    if [[ "${HOST_NETWORK:-0}" == "1" ]]; then
	      COMPOSE_FILES+=(-f docker-compose.hostnet.yml)
	      echo -e "${CYAN}ℹ HOST_NETWORK=1 set; including host networking overrides${NC}"
	    fi
	    # If host GUI is using 8787, avoid publishing hydreq port by adding nopublish override
	    if (echo > /dev/tcp/127.0.0.1/8787) >/dev/null 2>&1; then
	      echo -e "${YELLOW}ℹ Detected listener on localhost:8787; not publishing hydreq port${NC}"
	      COMPOSE_FILES+=(-f docker-compose.override.nopublish.yml)
          # Force recreate to ensure port mapping changes take effect on existing containers
          COMPOSE_UP_FLAGS=(up -d --build --force-recreate)
	    fi
	set +e
		    # Bring up all core services at once (httpbin, postgres, mssql, hydreq, playwright)
		    # Force rebuild to ensure hydreq binary embeds latest UI/assets
		    "${COMPOSE[@]}" "${COMPOSE_FILES[@]}" "${COMPOSE_UP_FLAGS[@]}" httpbin postgres mssql hydreq playwright
	up_rc=$?
	set -e
	if [[ $up_rc -ne 0 ]]; then
		echo -e "${YELLOW}⚠ WARN: Failed to start compose services (rc=$up_rc). Skipping service-based integration tests.${NC}"
	else
		services_started=1

		subsection "Waiting for services"
		echo -e "${CYAN}Waiting for httpbin...${NC}"
		HTTPBIN_URL="http://localhost:8080"
		# In host-network mode, httpbin listens on port 80
		if [[ "${HOST_NETWORK:-0}" == "1" ]]; then
			HTTPBIN_URL="http://localhost"
		fi
		for i in {1..30}; do
			curl -sSf "${HTTPBIN_URL}/ip" >/dev/null && break || sleep 2
		done
		export HTTPBIN_BASE_URL="$HTTPBIN_URL"
		echo -e "${CYAN}Waiting for Postgres...${NC}"
		for i in {1..30}; do
			if [[ "${HOST_NETWORK:-0}" == "1" && $(command -v pg_isready) ]]; then
				pg_isready -U postgres -h localhost && break || sleep 2
			else
				docker exec $(docker ps -qf name=postgres) pg_isready -U postgres && break || sleep 2
			fi
		done
		export PG_DSN="postgres://postgres:password@localhost:5432/qa?sslmode=disable"
		echo -e "${CYAN}Waiting for MSSQL port...${NC}"
		for i in {1..30}; do
			(echo > /dev/tcp/127.0.0.1/1433) >/dev/null 2>&1 && break || sleep 2
		done
		export MSSQL_DSN="sqlserver://sa:Your_password123@localhost:1433?database=master"

		subsection "Running database integration tests"
	PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" go test -run "Test(PG|MSSQL)Integration" -v ./internal/runner
	did_db_tests=1

		subsection "Running example test suites"
	ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" HTTPBIN_BASE_URL="$HTTPBIN_BASE_URL" PG_DSN="$PG_DSN" MSSQL_DSN="$MSSQL_DSN" ./scripts/run-examples.sh

				echo -e "\n${BOLD}${BLUE}========================================${NC}"
				echo -e "${BOLD}${CYAN}Running Playwright E2E tests${NC}"
				echo -e "${BOLD}${BLUE}========================================${NC}\n"
				E2E_FLAGS=""
				if [[ "${UPDATE_SNAPSHOTS:-0}" == "1" ]]; then
					E2E_FLAGS="--update-snapshots=all"
				fi
				"${COMPOSE[@]}" "${COMPOSE_FILES[@]}" exec -T playwright sh -lc "\
					set -e; \
					cd /work/test/e2e; \
					if [ ! -d node_modules ]; then npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1; fi; \
					npx playwright install --with-deps >/dev/null 2>&1 || true; \
					echo '▶ Running Playwright tests...'; \
					npx playwright test ${E2E_FLAGS} --reporter=dot --reporter=html \
				"
				if [[ "${DEMO:-0}" == "1" ]]; then
					set +e
					"${COMPOSE[@]}" "${COMPOSE_FILES[@]}" exec -e DEMO=1 -T playwright sh -lc "\
						set -e; \
						cd /work/test/e2e; \
						if [ ! -d node_modules ]; then npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1; fi; \
						npx playwright install --with-deps >/dev/null 2>&1 || true; \
						rm -rf test-results 2>/dev/null || true; \
						echo '▶ Running Playwright DEMO...'; \
						DEMO=1 npx playwright test ${E2E_FLAGS} tests/demo-showcase.spec.ts --project=demo --reporter=list --reporter=html; \
						echo '▶ Last run:'; \
						ls -l test-results | tail -n +1 || true; \
						if [ -f test-results/.last-run.json ]; then head -c 2000 test-results/.last-run.json; fi; \
					"
					PLAY_RC=$?
					set -e
					echo -e "${CYAN}▶ Playwright demo exit code: ${PLAY_RC}${NC}"
				fi
				set +e
					echo -e "${CYAN}Extracting latest demo artifacts from container...${NC}"
				CONT_ID=$(docker ps -qf name=playwright)
					VIDEO_SRC=""
					if [ -n "$CONT_ID" ]; then
					VIDEO_SRC=$(docker exec "$CONT_ID" sh -lc 'cd /work/test/e2e && ls -1t test-results/**/video.* 2>/dev/null | head -n1')
					fi
					set -e
					mkdir -p docs/screenshots
					if [[ -n "${VIDEO_SRC:-}" ]]; then
						# Clean previous demo outputs to avoid confusion
						rm -f docs/screenshots/demo.webm docs/screenshots/demo.gif || true
						# Copy video
						docker cp "$CONT_ID:/work/test/e2e/$VIDEO_SRC" docs/screenshots/demo.webm
						echo -e "${GREEN}✓ Pulled demo video from container: $VIDEO_SRC${NC}"
						# Also copy sibling screenshots from the same test-result dir
						RESULT_DIR=$(dirname "$VIDEO_SRC")
						LATEST_DIR="docs/screenshots/latest_demo"
						rm -rf "$LATEST_DIR" || true
						mkdir -p "$LATEST_DIR"
						docker cp "$CONT_ID:/work/test/e2e/$RESULT_DIR/." "$LATEST_DIR" || true
						# Promote any PNG screenshots to top-level for convenience
					find "$LATEST_DIR" -maxdepth 1 -type f -name "*.png" -exec cp -f {} docs/screenshots/ \; 2>/dev/null || true
					else
						# Fallback to host-mounted path if container copy failed
						set +e
						VIDEO_FILE=$(find test/e2e/test-results -type f \( -name 'video.*' -o -name '*video.*' \) -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | awk '{ $1=""; sub(/^ /, ""); print }')
						set -e
						if [[ -n "${VIDEO_FILE:-}" && -f "$VIDEO_FILE" ]]; then
							# Clean previous demo outputs
							rm -f docs/screenshots/demo.webm docs/screenshots/demo.gif || true
							cp -f "$VIDEO_FILE" docs/screenshots/demo.webm || true
							echo -e "${GREEN}✓ Copied demo video from host: $VIDEO_FILE${NC}"
							# Copy screenshots from the same result folder
							RESULT_DIR=$(dirname "$VIDEO_FILE")
							LATEST_DIR="docs/screenshots/latest_demo"
							rm -rf "$LATEST_DIR" || true
							mkdir -p "$LATEST_DIR"
							cp -a "$RESULT_DIR/." "$LATEST_DIR" 2>/dev/null || true
						find "$LATEST_DIR" -maxdepth 1 -type f -name "*.png" -exec cp -f {} docs/screenshots/ \; 2>/dev/null || true
						else
							echo -e "${YELLOW}⚠ WARN: No demo video found to copy (container or host).${NC}"
						fi
					fi
					if [[ -f docs/screenshots/demo.webm && "${DO_GIF:-0}" == "1" ]]; then
						echo -e "${CYAN}Converting demo.webm to demo.gif...${NC}"
						./scripts/make-demo.sh docs/screenshots/demo.webm docs/screenshots/demo.gif || true
					fi
		# Tear down compose (unless KEEP_SERVICES=1)
		if [[ "${KEEP_SERVICES:-0}" != "1" ]]; then
			subsection "Shutting down compose services"
					"${COMPOSE[@]}" "${COMPOSE_FILES[@]}" down --remove-orphans || true
		fi
	fi
else
		echo -e "${YELLOW}⚠ docker or compose not available; skipping service-based integration tests${NC}"

	subsection "Running example test suites (DB tests skipped)"
	ENABLE_DEMO_AUTH="${ENABLE_DEMO_AUTH:-1}" ./scripts/run-examples.sh || true
fi

if [[ "$did_db_tests" != "1" ]]; then
	subsection "Tips for running database integration tests"
	echo -e "${CYAN}To run DB integration tests, set environment variables and run targeted tests, e.g.:${NC}"
	echo "  PG_DSN=postgres://user:pass@localhost:5432/db?sslmode=disable go test -run TestPG ./..."
	echo "  MSSQL_DSN=sqlserver://sa:Your_password123@localhost:1433?database=master go test -run TestMSSQL ./..."
fi

section "Reports and Summary"

subsection "Generating PR summary"
# Generate a local PR-style summary from the most recent report (if any)
if ls -1 ./reports/*.json >/dev/null 2>&1; then
	latest_report=$(ls -t ./reports/*.json 2>/dev/null | head -n1 || true)
	if [[ -n "${latest_report:-}" && -f "$latest_report" ]]; then
		summary_out="./reports/PR_SUMMARY.md"
		{
			scripts/pr-summary.sh "$latest_report" || true
			echo
			#echo "#### Suggested assertions"
			#scripts/suggest-assertions.sh "./reports" || true
			echo
			echo "> Local summary generated by scripts/local-ci.sh"
		} > "$summary_out"
		echo -e "${GREEN}✓ Generated PR summary at: $summary_out${NC}"

		# Optionally post the summary to a PR when GH_PR_REF is set and gh CLI is available
		if [[ -n "${GH_PR_REF:-}" ]]; then
			if command -v gh >/dev/null 2>&1; then
				echo -e "${CYAN}ℹ Posting summary to PR: $GH_PR_REF${NC}"
				scripts/post-pr-summary.sh "$GH_PR_REF" "$latest_report" || echo -e "${YELLOW}⚠ WARN: Failed to post summary to PR (continuing)${NC}"
			else
				echo -e "${YELLOW}⚠ gh CLI not found. Install GitHub CLI and set GH_PR_REF to auto-post this summary.${NC}"
			fi
		else
			echo -e "${CYAN}ℹ Tip: Set GH_PR_REF=PR_NUMBER (or URL) to auto-post this summary via GitHub CLI.${NC}"
		fi
	fi
else
	echo -e "${YELLOW}⚠ No reports found in ./reports; skipping PR summary generation.${NC}"
fi
