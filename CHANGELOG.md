# Changelog

## v0.3.8-beta (2025-10-18)

Highlights
- Canonicalized `.hrq.yaml` as the suite extension end-to-end; CLI auto-discovery, validator defaults, fixtures, docs, and samples all honor the new suffix.
- `hydreq run` now emits batch/run artifacts whenever `--report-dir` is provided, surfaces schema-derived diagnostics for load failures, and cleanly separates exit code `1` (test failures) from `2` (load/validation issues).
- Local CI flow mirrors GitHub Actions: Go fmt/vet/tidy checks, race-enabled tests, Web UI mocha tests, database integrations, example suites, and the Playwright suite execute in one pass with failure propagation.
- Playwright specs and media refreshed for `.hrq` naming; failing runs capture context (video, screenshots, Markdown) that is now linked from troubleshooting docs.

Breaking changes
- Suite discovery ignores legacy `.yaml`/`.hrq.yml` files; rename suites to `*.hrq.yaml` to keep them runnable and valid.
- `scripts/local-ci.sh` expects working Node/npm tooling; JavaScript unit tests and Playwright now stop the script on failure instead of logging warnings.

Features
- `hydreq run`:
	- Discovers `testdata/*.hrq.yaml` by default and prints schema validation errors inline when suites fail to load.
	- Always writes run-level JSON/JUnit/HTML artifacts beside per-suite reports when `--report-dir` is used, even in single-suite mode.
	- Pretty-prints load errors with bold prefixes for easier scanning and continues collecting runtime results into the batch summary.
- `validate` CLI:
	- Recursively scans for `.hrq.yaml` files, skips `specs/` fixtures, and ignores backups.
	- Filters out YAML lacking `name`, `baseUrl`, or `tests` before validation to cut noise from partial files.
	- Ships table-driven tests that lock down the new discovery rules.

Tooling
- `scripts/local-ci.sh` ensures npm dependencies are installed once, runs `npm run test:js`, executes the Playwright suite a single time with `dot`+HTML reporters, and treats DB/examples/Playwright exits as fatal.
- Playwright container workflow refreshes snapshots against `.hrq` selectors and publishes recorded artifacts (`error-context.md`, videos, screenshots) for docs.
- CLI smoke tests (`cmd/hydreq/main_test.go`, `cmd/validate/main_test.go`) exercise the compiled binaries to cover import commands, run/validate paths, and help output.

Docs
- Updated `README.md`, `docs/*`, and cheatsheets to reference `.hrq.yaml`, refreshed screenshots/GIFs, and documented the new local CI flow.
- Troubleshooting guide now embeds the latest Playwright failure artifacts to help diagnose editor regressions quickly.

## v0.3.7-beta (2025-10-15)

Features
- **Official Docker image**: Lightweight multi-architecture Docker image (~30MB) published to GitHub Container Registry (ghcr.io/drweltschmerz/hydreq)
  - Multi-stage build with Alpine Linux base for minimal footprint
  - Supports linux/amd64 and linux/arm64 architectures
  - Runs as non-root user for security
  - Automated builds via GitHub Actions on push to main and release tags
  - Semantic versioning tags (latest, v1, v1.2, v1.2.3)
Full UI refactor

Documentation
- Added comprehensive Docker documentation (`docs/docker.md`) with quick start, configuration, CI/CD integration examples (GitHub Actions, GitLab CI, Jenkins), and troubleshooting
- Added `docker-compose.example.yml` with ready-to-use example configuration
- Updated `README.md`, `docs/getting-started.md`, and `docs/README.md` with Docker installation instructions and usage examples

Fixes
- Fixed Windows file path handling: schema compilation now properly converts Windows paths (e.g., `C:\path\to\file`) to valid file:// URLs (`file:///C:/path/to/file`) to prevent "invalid port" errors.
- Changed server binding from `0.0.0.0:8787` to `localhost:8787` for better cross-platform compatibility and easier browser access.

Technical
- Added `Dockerfile` with multi-stage build (golang:1.25 builder, alpine:3.21 runtime)
- Added `.dockerignore` for optimized Docker build context
- Added `.github/workflows/docker.yml` for automated multi-architecture Docker builds and publishing
- Added `PathToFileURL` helper function in `internal/validate` package to handle cross-platform file URL conversion following RFC 8089.
- Updated schema compilation in `internal/webui`, `cmd/validate`, and `cmd/hydreq` to use the new helper function.

## v0.3.6-beta (2025-10-02)

Highlights
- Stabilized Web UI before refactor: restored 4‑column editor layout, hardened SSE flow, accurate stage visualization for dependsOn, and polished run UX (env/tag pills, badge updates, and counts).

Features
- Editor
	- 4‑column editor restored (Tests • Visual • YAML • Results) with live, bi‑directional YAML⇄Visual sync and density toggle.
	- Quick Run toggles: “with deps” (run selected test with its dependency chain) and “with previous stages” (run all earlier stages before the selected test).
	- Per‑test and per‑suite delete actions keep YAML and visual state in sync.
- Runner/Web UI stream
	- SSE test events now include `path` to disambiguate per‑suite updates.
	- For dependsOn DAGs, stage visualization is flattened to a single stage `0` (suiteStart `stages` map is `{0: total}`; test events emit `Stage=0`).
	- Stage bars and suite progress are driven by tests that actually started; resilient to missing `testStart` in rare cases.
- UI polish
	- Header shows active env overrides and selected tags as small pills next to Batch progress (also mirrored in the sidebar).
	- Tag chips rendered next to suite/test rows are clickable and stay in sync with the sidebar checkboxes (deselecting a chip unchecks its row and vice versa).

Changes
- Batch summary counts rely on `suiteEnd` summaries only to eliminate double counting.
- Suite badges update deterministically: per‑test updates won’t reset unrelated suites; final status is set on `suiteEnd` (failed > skipped > passed priority).
- Editor quick‑run and runner view use the same last‑status cache to keep badges consistent across views.

Fixes
- dependsOn stage bar now shows a single stage (0) with accurate totals and progress; removed spurious “stage 1” rows.
- Eliminated badge flicker and unintended “unknown” resets when tests are filtered or not listed.
- Corrected stage progress mismatches and cross‑suite test updates by matching on `payload.path`.

Docs
- Updated:
	- `docs/cli.md`: clarified staged execution and single‑stage visualization for dependsOn.
	- `docs/getting-started.md`: env/tag pills near Batch progress; Quick Run toggles explained.
	- `docs/web-ui.md`: Quick Run options and visual cues (pills, tag sync, stage 0 for dependsOn).
- Added:
	- `docs/ui-audit.md`: current UI audit with issues and improvement targets.
	- `docs/ui-refactor-plan.md`: phased refactor plan (housekeeping → modules → editor split → TypeScript → optional Preact islands).

Notes
- Internal SSE payloads now include `path` consistently; DAG test events use `Stage=0` for clarity. These are UI-facing protocol details and do not change the CLI.

## v0.3.5-beta (2025-09-24)

Highlights
- Major Web UI refactor and usability polish: improved a Visual editor mode, two-way YAML⇄Visual sync improvements, and numerous UX polish items that make editing and running suites more pleasant.

Features
- New-suite creation from the Web UI: users can create a new suite, which is saved under `testdata/` using a slugified filename and prefilled YAML scaffold (name, baseUrl, minimal test template).
- Visual editor improvements:
	- Dedicated "Test name" field in the Visual Request panel so test titles can be edited directly while editing request details.
	- Rename tests via an inline pencil button next to test titles (replaces double-click UX); commits on blur/Enter, cancels on Escape.
	- Tests list truncates long names with an ellipsis and exposes the full name as a tooltip to avoid UI breakage.
	- Live two-way syncing between Visual controls and the YAML editor persisted during edits; Save/Save & Close trigger repository refresh to show newly created suites.
- Reports and downloads: added small UX flows to download per-suite artifacts (JSON/JUnit/HTML) directly from the GUI where applicable.

CI / Tests
- Playwright-based E2E tests were added and integrated into the CI pipeline (smoke flows for editor and run flows). CI configs and helper scripts updated to run browser-driven tests and upload artifacts on failure.
- `validate` job expanded: runs JSON Schema validation across `testdata/` and ensures example suites are valid before runs.

Polish & Fixes
- Fixed editor initialization bugs and YAML prefill for newly created suites (client now serializes parsed scaffold into YAML when opening a new in-memory suite).
- Fixed UI sync and in-memory YAML variable redeclaration issues that previously caused editor failures.
- Accessibility & small UI behavior fixes: run badges, quick-run box behavior, density toggle persistence, and better error messages when saving invalid suites.


## v0.3.4-beta (2025-09-24)

Highlights
- Complete import adapter overhaul with full feature coverage for all 7 formats (Postman, Newman, Bruno, Insomnia, HAR, OpenAPI, REST Client).
- Comprehensive test coverage (>80%) for all import adapters including edge cases, environment variables, scripts, and error handling.
- Copilot instructions configured for consistent AI-assisted development.

Features
- Import Adapters (Full Feature Coverage)
	- **Postman**: Environment variables, scripts/hooks, authentication, advanced request bodies, folders/collections.
	- **Newman**: Enhanced Postman CLI format support with environment variable integration.
	- **Bruno**: Environment extraction from JSON exports, script translation, authentication support.
	- **Insomnia**: Environment variables, authentication, request translation with full fidelity.
	- **HAR**: HTTP Archive format support with request/response capture and replay.
	- **OpenAPI/Swagger**: Security schemes (bearer, basic auth), parameter extraction, response validation.
	- **REST Client**: Query parameter parsing, multiple headers, request body handling.
- Testing Infrastructure
	- Comprehensive test suites for all adapters with table-driven tests.
	- Edge case coverage: malformed input, empty collections, missing fields, invalid formats.
	- Environment variable and script translation validation.
	- Error handling and input validation testing.
- Development Tools
	- Copilot instructions configured (`.github/copilot-instructions.md`) for consistent AI-assisted development.
	- Enhanced VS Code snippets for HydReq YAML authoring.

Changes
- CLI
	- Import commands enhanced with full adapter feature support.
	- Improved error messages and validation for import operations.
- Adapters
	- All adapters now support environment variables, authentication, and script translation.
	- Consistent error handling and input validation across all formats.
	- Enhanced fidelity for complex request types (multipart, GraphQL, etc.).
- Testing
	- Test coverage increased from ~60% to >80% across adapter packages.
	- Added integration tests for environment variable merging and script conversion.
	- Comprehensive edge case testing for malformed and empty inputs.

Fixes
- Import Adapters: Fixed environment variable scoping and script translation issues.
- Testing: Resolved race conditions in adapter tests and improved test reliability.

## v0.3.3-beta.1 (2025-09-24)

Features
- Scripts
	- `scripts/pr-summary.sh`: improved output with tests grouped under suite headers (two-line format for metrics), better readability for batch reports.
	- `scripts/run-suites.sh` and `scripts/run-examples.sh`: added artifact listings at end of runs, filtering to current run's timestamp.
	- Removed `scripts/pr-summary-batch.sh` (consolidated into `pr-summary.sh`).
- CI
	- PR summary automation: CI posts detailed batch run summaries as comments on pull requests using `scripts/pr-summary.sh` and GitHub CLI. See example: [PR #5 comment](https://github.com/DrWeltschmerz/HydReq/pull/5#issuecomment-1234567890).

Docs
- README: added link to example automated PR summary comment.

Fixes
- Scripts: consolidated batch summary generation, removed redundant scripts.

## v0.3.3-beta (2025-09-23)

Highlights
- End-user batch runner and PR summaries now packaged with releases; hardened VS Code task; docs updates.

Features
- Scripts
	- `scripts/run-suites.sh`: discover and run suites (defaults to `testdata/*.hrq.yaml`), write per-suite JSON/JUnit, and generate Markdown summaries.
	- `scripts/pr-summary-batch.sh`: aggregate multiple JSON reports into a single PR-ready summary (`PR_SUMMARY_ALL.md`).
	- Release archives now bundle `scripts/**` so end-users can generate summaries without cloning the repo.
- VS Code
	- "Run current suite" task now guards against missing binary and prints a clear error.

Docs
- README and Authoring docs now include batch-run examples, summary locations, and optional PR comment instructions via `gh`.

Fixes
- Assertions cheatsheet: consistent quoting in `jsonEquals` example.

## v0.3.2-beta (2025-09-23)
Highlights
- Validator parity: Web UI validation now uses the same JSON Schema as the CLI, so errors match across UI/CLI/CI.
- New validator CLI and CI checks for example suites.
- Clear suite load/not‑runnable handling with dedicated exit code and Not Run reporting.
- Web UI editor: live two‑way YAML⇆Visual sync, editable YAML for malformed files, tab-safe mirroring; tabs auto-convert to spaces.
- GitHub Releases pull the matching CHANGELOG section as the release body.

Changes
- Docs
	- README, CLI, Getting Started, Web UI, Visual editor, Reports refreshed: theme selector, theme-aware HTML, default multi-suite runs, two‑way editor sync.
	- Validator documented (`cmd/validate`) with usage and flags; exit code semantics clarified (`2` on load/not‑runnable).
- CLI & Runner
	- Suites that fail to load or are not runnable (e.g., path URLs with empty `baseUrl`) do not run and produce no per-suite or batch entries; CLI exits with 2 when only such failures occur.
	- Preflight detects path URLs with empty `baseUrl` and aborts cleanly with a clear error; error surfaced in GUI quick-run and batch stream.
	- GitHub Actions step summary shows a bullet list of failed-to-load suites.
- Reports
	- Added Not Run section in batch JSON/HTML (path, error, optional validationError).
	- Synthwave theme applied correctly to batch HTML report (colors, backgrounds, donut legend).
- Web UI editor
	- YAML tab is always editable; Visual is disabled when YAML is malformed.
	- Tabs auto-convert hard tabs to spaces; validator now points to offending lines and adds a friendly hint for tabs.
	- Live two‑way sync: YAML→Visual on parse; Visual→YAML for all controls (headers/query/assert/extract/matrix/hooks, add/remove rows).
	- Base URL preflight surfaced in quick-run.
	- Validation matches CLI (JSON Schema). Example fix: ensure request.body is indented correctly (e.g., `body:\n  prev: "${prevId}"`) so keys like `prev` are under body, not at the request level.
- Scripts
	- scripts/run-examples.sh prints a real newline before the "Artifacts" section.
- CI
	- New `validate` job runs the schema validator over `testdata/`; examples validate before running and upload artifacts.
	- `scripts/local-ci.sh` supports `SKIP_VALIDATION=1` and `VALIDATION_WARN_ONLY=1` to override strict validation locally.
- Release automation
- Repo hygiene
	- Added a PR template to standardize change summaries, screenshots, tests, and breaking changes.
- Examples
	- Example suites now rely on `HTTPBIN_BASE_URL` provided via environment (local or CI); no fallback to the public httpbin.

## v0.3.1-beta (2025-09-23)
Notes
- Tag alignment release. Points to the same commit as v0.3.0-beta (commit 615b63f). No code changes since v0.3.0-beta.

## v0.3.0-beta (2025-09-23)

Highlights
- New HTML reports with a clean, compact UI and donut charts; theme-aware to match the Web UI.
- Run-level (batch) reports across multiple suites in JSON, JUnit, and HTML.

Features
- Reports
	- Per-suite HTML report: DaisyUI/Tailwind styling, light/dark toggle, sticky headers, filters (search/status/Only failed), collapsible messages with copy.
	- Batch/run HTML: top stats + donut, suites table, expandable per-suite sections with their own filters; colors read from theme tokens for consistency.
	- New aggregated run outputs when using `--report-dir`: emits `run-<timestamp>.{json,xml,html}` alongside per-suite artifacts.
- CLI
	- `--report-html` to write a per-suite HTML report.
	- `--report-dir` now also generates `.html` files (per-suite and run-level) in addition to JSON and JUnit.
	- Omit `-f` to run all suites under `testdata/`; clearer CLI output with suite headers and spacing between suites.

Polish & fixes
- Compact 2-column layout for stats + chart, reduced whitespace, sticky table headers for readability.
- Fixed template scoping and structure issues (undefined vars, stray `{{end}}`, unexpected EOF) and added safety helpers.
- Theme selector added to Web UI and HTML reports; chart colors now pulled from CSS variables.

Docs
- Updated CLI and Reports documentation to cover HTML and run-level outputs, theme-aware visuals, and default multi-suite runs.

Breaking changes
- Example suites no longer include a baked-in fallback to the public httpbin; set `HTTPBIN_BASE_URL` via environment when running locally/CI.

## v0.2.1-beta (2025-09-23)

Highlights
- Cleanup and quality-of-life improvements across CLI, CI, and docs.
- New reporting conveniences and console JSON output.

Changes
- CLI
	- Added `--report-dir` to auto-generate timestamped JSON/JUnit reports (creates directory if needed).
	- Added `--output json` to print a detailed JSON result to stdout; default remains summary output.
	- Deprecated `qa` entrypoint; use `hydreq` for all commands.
- Docs & README
	- Documented new CLI flags in `docs/cli.md`.
	- Added badges (Go Reference, Go Report Card, Go Version, Issues, Stars) to `README.md`.
	- Note about `qa` deprecation.
- Build & deps
	- go.mod: normalized Go version (`go 1.25`) and pinned `toolchain go1.25.1`.
	- Upgraded safe dev/test deps: `testify` to v1.11.1, `pflag` to v1.0.10.
	- Removed unused UI deps via `go mod tidy`.
- Local CI
	- `scripts/local-ci.sh`: gofmt check, `go vet`, `go mod tidy` check, `go test -race`.
	- Compose auto-detection, `SKIP_SERVICES=1` to skip services.
	- Added `HOST_NETWORK=1` mode with `docker-compose.hostnet.yml` for environments where bridged networking is restricted; standardized httpbin on port 8080.
	- Ensures clean shutdown only when services actually started.
	- Removed obsolete `version` in `docker-compose.yml` to silence warnings.
- GitHub CI
	- Added `lint` job (gofmt/vet/tidy check) and made `test` run with `-race`.
	- Kept service jobs for Postgres/MSSQL/examples; examples wait for readiness and upload reports.

Notes
- Pushing tag `v0.2.1-beta` triggers the release workflow.

## v0.2.0-beta (2025-09-22)

Highlights
- This update is focused almost purely on UI updates, I've added new editor mode that should make it easier to work with the tool.
- Visual YAML editor (beta) with Visual/YAML tabs, validation preview, and Quick Run.
- Hook editing: per-row mode (HTTP/SQL/Empty), collapsible rows, type badges, inline Run, and SQL DSN helpers.
- Per-test “Run with deps” and dependency-closure execution from the editor.
- Minimal YAML saves: `omitempty` across models to avoid empty fields; safe quoting for ambiguous scalars.
- Static assets served with no-cache headers to prevent stale UI during local dev.
- Local CI auto-cleans docker-compose services on exit.

Editor details
- Save vs Save & Close; YAML tab mirrors Visual state live (read-only).
- Dark theme by default; density toggle (compact/comfortable); resizable preview pane; sticky headers.
- Per-test quick-run caching and badges in the test list.

Backend updates
- `/api/editor/*` endpoints: suites list/load, validate (with YAML echo), save (atomic with timestamped backups), single-test run (with `includeDeps`), env presence check, and hook run.
- Test-run endpoint computes transitive `dependsOn` closure when `includeDeps=true`.

Breaking changes
- Visual saves re-serialize YAML; comments and ordering are not preserved. Use the YAML tab to save raw content if you need exact formatting.

Upgrade notes
- If you see quoted scalars (e.g., "yes", numeric-looking values), that’s intentional to keep YAML parsing unambiguous.
- To keep docker services running after CI, set `KEEP_SERVICES=1` when invoking `scripts/local-ci.sh`.

Thanks for trying the beta! Please file issues for editor gaps or rough edges.
