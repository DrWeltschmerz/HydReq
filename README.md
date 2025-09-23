# 🐙 HydReq (Hydra Request)

> 🚀 **API Testing Simplified**  
> Write YAML tests, run in CLI/Web UI, generate reports. Supports matrices, hooks, OpenAPI, and CI automation.

<table width="100%" border="0" cellpadding="6" cellspacing="0">
  <tr>
    <td width="33%" valign="middle" align="left">
      <a href="https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml"><img src="https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml/badge.svg" alt="CI" height="20"></a>
      <a href="https://github.com/DrWeltschmerz/HydReq/releases"><img src="https://img.shields.io/github/v/release/DrWeltschmerz/HydReq?include_prereleases&sort=semver&style=flat-square" alt="Release" height="20"></a>
    </td>
    <td width="34%" valign="middle" align="center">
      <a href="go.mod"><img src="https://img.shields.io/github/go-mod/go-version/DrWeltschmerz/HydReq?style=flat-square" alt="Go Version" height="20"></a>
      <a href="https://pkg.go.dev/github.com/DrWeltschmerz/HydReq"><img src="https://pkg.go.dev/badge/github.com/DrWeltschmerz/HydReq.svg" alt="Go Reference" height="20"></a>
      <a href="https://goreportcard.com/report/github.com/DrWeltschmerz/HydReq"><img src="https://goreportcard.com/badge/github.com/DrWeltschmerz/HydReq" alt="Go Report Card" height="20"></a>
    </td>
    <td width="33%" valign="middle" align="right">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License" height="20"></a>
    <a href="https://github.com/DrWeltschmerz/HydReq/stargazers"><img src="https://img.shields.io/github/stars/DrWeltschmerz/HydReq?style=social" alt="Stars" height="20"></a>
    </td>
  </tr>
  <tr>
    <td valign="top" align="left" width="25%">
      <img src="logo_notext.svg" alt="HydReq Logo" width="160">
    </td>
    <td valign="top" align="center" width="50%">
      <p><strong>Lightweight API test runner with a clean Web UI and CLI.</strong></p>
      <p>Author tests in YAML, run them locally or in CI across Windows, macOS, and Linux. Now with a validator CLI, run-level reports, batch summaries, and a live two‑way Web UI editor.</p>
      <p><em>Note: The `qa` CLI entrypoint has been deprecated; use `hydreq`.</em></p>
    </td>
    <td valign="top" align="right" width="25%">
      <p style="text-align:right; margin:0;">
        <a href="docs/README.md">📖 Full Docs</a><br>
        <a href="docs/getting-started.md">🚀 Quick Start</a><br>
        <a href="docs/examples.md">🧪 Examples</a><br>
        <a href="#copilot-and-editor-support">🤖 Copilot Setup</a>
      </p>
    </td>
  </tr>
</table>

## Documentation

- Full docs: `docs/README.md`
- Quick links: [Getting started](docs/getting-started.md), [Web UI](docs/web-ui.md), [CLI](docs/cli.md), [Authoring](docs/authoring.md), [Scheduling](docs/scheduling.md), [Hooks](docs/hooks.md), [SQL hooks](docs/sql-hooks.md), [OpenAPI](docs/openapi.md), [Visual editor](docs/visual-editor.md), [Adapters](docs/adapters.md), [Reports](docs/reports.md), [Examples](docs/examples.md), [Troubleshooting](docs/troubleshooting.md), [Contributing](docs/contributing.md), [Roadmap](docs/roadmap.md), [What’s new](CHANGELOG.md), Cheatsheets: [Suite](docs/cheatsheets/suite.cheatsheet.md), [Assertions](docs/cheatsheets/assertions.cheatsheet.md)

## Contents

- [For end users](#for-end-users)
  - [Quick start (GUI)](#quick-start-gui)
  - [Quick start (CLI)](#quick-start-cli)
  - [Install](#install)
  - [Using the Web UI](#using-the-web-ui)
  - [Using the CLI](#using-the-cli)
  - [Copilot and editor support](#copilot-and-editor-support)
  - [Data generators](#data-generators)
  - [Features](#features)
  - [Adapters (import)](#adapters-import)
  - [Reports](#reports)
  - [Batch run and summaries](#batch-run-and-summaries)
  - [Example suites (at a glance)](#example-suites-at-a-glance)
  - [Troubleshooting](#troubleshooting)
- [Contributing & development](#contributing--development)
  - [Local services](#local-services)
  - [Run everything locally (one command)](#run-everything-locally-one-command)
  - [Auth example (local)](#auth-example-local)
  - [Project layout](#project-layout)
  - [Editors & Copilot (contributors)](#editors--copilot-contributors)
  - [Roadmap](#roadmap)
- [License](#license)

---

## For end users

### Quick start (GUI)

1) Download a prebuilt archive from the Releases page for your OS/arch.
2) Unzip and run the `hydreq` binary.
3) Your browser opens at http://127.0.0.1:8787.
  - Left: select suites from `testdata`, set Workers, Tags (optional), Default timeout (optional), and env overrides (KEY=VALUE).
   - Right: progress for batch/suite/stages and a console with per-test start/result lines and collapsible details.

### Quick start (CLI)

1) Download a prebuilt release archive for your OS/arch and unzip.
2) Run a suite from the terminal:

```
./hydreq run -f testdata/example.yaml --workers 4 -v
```

3) Optional reports (JSON + JUnit):

```
./hydreq run -f testdata/example.yaml \
  --report-json report.json \
  --report-junit report.xml
```

### 📦 Install

- Prebuilt binaries (recommended): download from Releases. Archives include examples (`testdata/`), JSON schema, VS Code mappings, and Copilot prompts.
- From source:
  - `go install github.com/DrWeltschmerz/HydReq/cmd/hydreq@latest`
  - or `go build -o bin/hydreq ./cmd/hydreq`

### Using the Web UI

- Start: run `hydreq` with no arguments (opens the local GUI).
- Controls: Only failed, Auto-scroll, Theme selector (light/dark and more), Stop. Keyboard shortcuts: r=run, s=stop, c=clear, f=only failed, d=dark.
- Each test shows a blue “starting” line, then flips to ✓/✗/– when done. Failures include expandable details.
- A summary appears for every suite and a final batch summary aggregates pass/fail/skip.
- Editor: Click “Edit” next to a suite for a Visual + YAML editor with validation, Quick Run (with deps), hook editing (HTTP/SQL), and Save vs Save & Close.
  - Tip: For CI artifacts (JSON/JUnit/HTML), prefer the CLI flags `--report-json` / `--report-junit` / `--report-html`.
  - Extras: Live two‑way sync between YAML and Visual; malformed YAML keeps YAML editable and temporarily disables Visual; tabs are converted to spaces automatically; dark theme by default; density toggle; resizable preview; SQL DSN helper templates and show/hide for DSNs.

### Using the CLI

- Run all suites: `./hydreq run --workers 4 -v` (when `-f` is omitted, HydReq discovers and runs all suites under `testdata/`).
- Run a single suite: `./hydreq run -f testdata/example.yaml --workers 4 -v`
- Reports: add `--report-json report.json`, `--report-junit report.xml`, and/or `--report-html report.html` for detailed outputs.

Auto-generate reports (no per-report flags)
- Generate JSON, JUnit, and HTML with default names for all suites:
  - `./hydreq run --report-dir reports`
- Or for one suite:
  - `./hydreq run -f testdata/example.yaml --report-dir reports`
Naming:
- Per-suite: `<suite>-<timestamp>.{json,xml,html}`
- Run-level (batch): `run-<timestamp>.{json,xml,html}`

Validate suites locally (optional but recommended)

```
go build -o bin/validate ./cmd/validate
./bin/validate -dir testdata -schema schemas/suite.schema.json
```

The CI runs this validator too and will fail if any suite drifts from the schema.

Exit codes
- `0` all tests passed; `1` test failures; `2` suite failed to load or is not runnable (invalid YAML, missing baseUrl for path URLs). Not‑runnable suites do not emit results and appear in the batch report's Not Run section.

CLI flags
- `--file` (or `-f`): path to YAML suite (optional; when omitted, all suites in `testdata/` are run)
- `--workers`: concurrent workers per stage (default 4)
- `--tags`: comma-separated tag filter (any-of)
- `--default-timeout-ms`: default per-request timeout when `test.timeoutMs` is not set (default 30000)
- `--verbose` (or `-v`): verbose failure details
- `--report-json` / `--report-junit`: write detailed reports to files

Exit codes
- `0`: all tests passed
- `1`: tests failed
- `2`: suite load error

### 🤖 Copilot and editor support

HydReq ships with a JSON Schema and Copilot prompts so you get completions, validation, and smarter AI assistance while writing suites.

What you get
- Schema-backed completions and hover docs for fields (name, request, assert, matrix, hooks, etc.).
- Instant validation with problem squiggles when keys/values don’t match the schema.
- Copilot hints tailored to HydReq’s YAML via curated prompts and examples.

How to use it (quick)
1) Open this repository in VS Code (or copy `schemas/` and `.copilot/` into your project).
2) Ensure the YAML extension is installed (ms-azuretools.vscode-yaml).
3) The repo’s `.vscode/settings.json` already maps the schema; open any `*.yaml` in `testdata/` and you’ll get completions.
4) For your own project, add this mapping in VS Code settings:

```json
"yaml.schemas": {
  "./schemas/suite.schema.json": [
    "suite.yaml",
    "suites/**/*.yaml",
    "**/hydreq*.yaml"
  ]
}
```

Copilot tips that work
- Open `.copilot/prompts/suite.prompts.md` side-by-side with your suite YAML. Copilot reads open tabs and adapts suggestions.
- Start with a short comment describing your target API, baseUrl, and auth. Example:

```yaml
# HydReq: httpbin smoke; baseUrl=${ENV:HTTPBIN_BASE_URL}; tags=smoke
```

- Use one well-formed example test; then ask Copilot for variations (matrix, tags, retries) and it’ll stay on-rails.
- Keep schema visible: hover a field to see allowed keys/values; fix squiggles early.

Where things live
- Schema: `schemas/suite.schema.json`
- Prompts: `.copilot/prompts/suite.prompts.md`
- VS Code how-to: `.copilot/README.md` (includes a ready-to-copy `yaml.schemas` snippet)

VS Code helpers
- Task: “hydreq: Run current suite” (Terminal → Run Task) runs the active YAML with the built `hydreq`.
- Scripts: `scripts/pr-summary.sh` (PR markdown from a JSON report), `scripts/suggest-assertions.sh` (checklist of suggested assertions from last report).

### 🎲 Data Generators

Embed dynamic data anywhere interpolation works:
- `${FAKE:uuid}` — random UUID v4
- `${EMAIL}` — random email like `qa-<hex>@example.com`
- `${NOW:<layout>}` — current time formatted with Go layout (e.g., `${NOW:2006-01-02}`)
- `${NOW+/-offset:<layout>}` — time offset by s/m/h/d/w (e.g., `${NOW+1d:2006-01-02}`)
- `${RANDINT:min:max}` — random integer in `[min, max]`

### ✨ Features

| Feature | Description |
|---------|-------------|
| 🧪 YAML Suites | Variables, environment overrides, matrices |
| 🌐 HTTP Requests | Methods, headers, query, body with full control |
| ✅ Assertions | Status, headers, JSON paths, body contains, response time |
| 🔄 Extractions | Pull variables from responses (JSONPath) for reuse |
| 🎨 Colorful CLI | Per-stage concurrency, worker pools, progress |
| 🏷️ Tags & Filtering | Run subsets with `--tags` |
| 🔁 Retries | With backoff, jitter, and configurable limits |
| 🔐 Auth Helpers | Bearer/Basic via environment variables |
| 📊 Matrix Expansion | Data-driven test combinations |
| 🪝 Hooks | Pre/post suite/test


