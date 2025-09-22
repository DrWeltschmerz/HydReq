# Changelog

## v0.2.0-beta (2025-09-22)

Highlights
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
