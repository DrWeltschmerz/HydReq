# Changelog

## v0.3.0-beta (2025-09-23)

Highlights
- New HTML reports with a clean, compact UI and donut charts.
- Run-level (batch) reports across multiple suites in JSON, JUnit, and HTML.

Features
- Reports
	- Per-suite HTML report: DaisyUI/Tailwind styling, light/dark toggle, sticky headers, filters (search/status/Only failed), collapsible messages with copy.
	- Batch/run HTML: top stats + donut, suites table, expandable per-suite sections with their own filters.
	- New aggregated run outputs when using `--report-dir`: emits `run-<timestamp>.{json,xml,html}` alongside per-suite artifacts.
- CLI
	- `--report-html` to write a per-suite HTML report.
	- `--report-dir` now also generates `.html` files (per-suite and run-level) in addition to JSON and JUnit.

Polish & fixes
- Compact 2-column layout for stats + chart, reduced whitespace, sticky table headers for readability.
- Fixed template scoping and structure issues (undefined vars, stray `{{end}}`, unexpected EOF) and added safety helpers.

Docs
- Updated CLI and Reports documentation to cover HTML and run-level outputs with examples.

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
