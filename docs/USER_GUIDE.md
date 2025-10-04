# HydReq User Guide

This single guide walks you through everything you need for day‑to‑day use:

1) Install & Run
- Download a release or build from source.
- Run the Web UI (GUI) or the CLI.

2) Web UI
- Landing page: suites list, selection, tags, env overrides, run controls, progress, and logs.
- Editor: visual tabs (suite, request, assert, extract, retry, matrix, openApi, hooks), YAML tab with two‑way sync, validation, quick run.
- Quick Run: run selected test with options (with deps, with previous stages), inspect messages.
- Batch run: select suites and run; track stage progress and per-test outcomes; download JSON/JUnit/HTML.

3) CLI
- hydreq run -f suite.yaml [--workers N] [--tags smoke] [--report-json path] [--report-junit path] [--report-dir dir]
- hydreq import <format> <file> — Postman, Insomnia, HAR, OpenAPI, Bruno, REST Client, Newman.
- validate — validate suites against the JSON schema.

4) OpenAPI validation
- Configure at suite level (openApi.file + enabled) and per test (inherit/enable/disable).
- Response validation integrates into assertions.

5) Hooks (HTTP/SQL/JS)
- Pre/Post suite/test hooks; HTTP, SQL (sqlite/pgx/sqlserver), JavaScript. Extract variables; re-use via ${var}.

6) Data features
- Variables, env overrides, generators (${FAKE:uuid}, ${EMAIL}, ${NOW}, ${RANDINT}), matrix expansion.

7) Reports
- JSON with details, JUnit XML for CI, HTML for interactive viewing. Batch and per-suite artifacts.

8) Tips & Shortcuts
- Keyboard: r (run), s (stop), c (clear), f (only failed), d (dark).
- Theme selector; density toggle; resizable editor panes.

See also:
- Visual Editor Guide: docs/visual-editor.md (screenshots, step‑by‑step)
- Troubleshooting: docs/troubleshooting.md