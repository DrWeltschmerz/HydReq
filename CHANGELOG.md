# Changelog

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
