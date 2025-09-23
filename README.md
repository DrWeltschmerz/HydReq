# HydReq (Hydra Request)

[![CI](https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml/badge.svg)](https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/DrWeltschmerz/HydReq?include_prereleases&sort=semver)](https://github.com/DrWeltschmerz/HydReq/releases)
[![Downloads](https://img.shields.io/github/downloads/DrWeltschmerz/HydReq/total.svg)](https://github.com/DrWeltschmerz/HydReq/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Go Reference](https://pkg.go.dev/badge/github.com/DrWeltschmerz/HydReq.svg)](https://pkg.go.dev/github.com/DrWeltschmerz/HydReq)
[![Go Report Card](https://goreportcard.com/badge/github.com/DrWeltschmerz/HydReq)](https://goreportcard.com/report/github.com/DrWeltschmerz/HydReq)
[![Go Version](https://img.shields.io/github/go-mod/go-version/DrWeltschmerz/HydReq)](go.mod)
[![Issues](https://img.shields.io/github/issues/DrWeltschmerz/HydReq.svg)](https://github.com/DrWeltschmerz/HydReq/issues)
[![Stars](https://img.shields.io/github/stars/DrWeltschmerz/HydReq?style=social)](https://github.com/DrWeltschmerz/HydReq/stargazers)

```
                           *%%%%%%%%%%%%%%%@:                                   
                       @%%%%%%%%%%%%%%%%%%%%%%%%*                               
                    @%%%%%%%                @%%%%%%#                            
                  %%%%%@      *@%%%%%%*         %%%%%@                          
                %%%%%     @%%%%%%%@%@%%%%         +%%%%@                        
              +%%%%    %%%%%%%%%%%%  %%%%%%%%%      +%%%%                       
             @%%%%   #%%%%%%%%%%%%%%%%%%%%%%%%%       @%%%#                     
            @%%%    %%%%%%%@   %%%%%%       %%=        *%%%%                    
           @%%%    %%%%%%      @%%%%%%%@                :%%%#                   
          :%%%-   %%%%%%           +#*+:        %        *%%%                   
          %%%@   %%%%%#                   %%%%%%%%%%%@    %%%%                  
         .%%%    %%%%@                  %%%%%%%%   @%%%@   %%%                  
         @%%%    %%%%=     #%%%%%%%%%:  @%@%%%%%%%%%%%%%%  %%%%                 
         @%%@    %%%%    @%%%%%%%%%%%@         %%%%%%%%%%  @%%%                 
         @%%@    %%%%=  %%%%%%%%@           %%%%%%%%%%%%%  @%%%                 
         @%%%    %%%%% @%%%%%%%%%%%%           %@@%%%%%%%  @%%%                 
         *%%%     %%%%%%%%%%                       %%%%%%  %%%#                 
          %%%+    :%%%%%%%%%                       %%%%%+ #%%%                  
          %%%%      %%%%%%%%@                     %%%%%@  %%%%                  
           %%%%      @%%%%%%%@                   %%%%%@  %%%%                   
            %%%@       %%%%%%%%@               @%%%%%+  @%%%                    
             %%%%        @%%%%%%%%@+       *%%%%%%%@   %%%%                     
              %%%%+     @   @%%%%%%%%%%%%%%%%%%%%=   +%%%%                      
               %%%%%      %@    =@%%%%%%%%%%@*     .%%%%@                       
                 %%%%%*     +%%%@                #%%%%%                         
                   @%%%%%#       :*@%@%-      #%%%%%@                           
                      %%%%%%%@*          *@%%%%%%%-                             
                         %%%%%%%%%%%%%%%%%%%%%@                                  
                              :%@%%%%%%@%:                                       
                                                                                
                                                                                
     +%@     :%%                   %%*  @@@@@@%                                  
     =%%     :%%                   %%*  %%%##@%%%                                
     =%%     :%%  %%%   -%%  +%%%%@%%#  %%#    %%:  @%%%%@    %%%%%%%%.         
     =%%%%%%%%%%   %%   %%- @%%   .%%*  %%%--%%%%  %%.   %%  %%%   #%%.         
     =%%     .%%   =%% @%@  %%.    %%*  %%%%%%%   -%%%%%%%%- %%     %%.         
     =%%      %%    %%@%%   %%@    %%*  %%#  %%%   %%        %%@    %%.         
     =%%      %%     @%%     @%%%%%%%*  %%#   #%%   %%%%%%@   %%%%%%%%.         
                     %%%                                            %%.         
                   %%%%                                             %%.         
                                                                                
```

Lightweight API test runner with a clean Web UI and CLI. Author tests in YAML, run them locally or in CI across Windows, macOS, and Linux.

Note: The `qa` CLI entrypoint has been deprecated; use `hydreq`.

## Documentation

- Full docs: `docs/README.md`
- Quick links: [Getting started](docs/getting-started.md), [Web UI](docs/web-ui.md), [CLI](docs/cli.md), [Authoring](docs/authoring.md), [Scheduling](docs/scheduling.md), [Hooks](docs/hooks.md), [SQL hooks](docs/sql-hooks.md), [OpenAPI](docs/openapi.md), [Visual editor](docs/visual-editor.md), [Adapters](docs/adapters.md), [Reports](docs/reports.md), [Examples](docs/examples.md), [Troubleshooting](docs/troubleshooting.md), [Contributing](docs/contributing.md), [Roadmap](docs/roadmap.md), [What’s new](CHANGELOG.md)

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

### Install

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
  - Extras: YAML tab mirrors the Visual state live (read‑only); dark theme by default; density toggle (compact/comfortable); resizable preview pane; SQL DSN helper templates and show/hide for DSNs.

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

### Copilot and editor support

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

### Data generators

Embed dynamic data anywhere interpolation works:
- `${FAKE:uuid}` — random UUID v4
- `${EMAIL}` — random email like `qa-<hex>@example.com`
- `${NOW:<layout>}` — current time formatted with Go layout (e.g., `${NOW:2006-01-02}`)
- `${NOW+/-offset:<layout>}` — time offset by s/m/h/d/w (e.g., `${NOW+1d:2006-01-02}`)
- `${RANDINT:min:max}` — random integer in `[min, max]`

### Features
- YAML test suite with variables and environment overrides (${ENV:VAR})
- HTTP requests (method, URL, headers, query, body)
- Assertions: status, headers, JSON path equals/contains, body contains, response time
- Extract variables from responses (JSONPath) and reuse later
- Colorful CLI with per-stage concurrency and worker pool
- Tags filter (run subset with --tags)
- Retries with optional backoff + jitter
- Auth helpers (Bearer/Basic via env)
- Data-driven matrix expansion
- Hooks: preSuite/postSuite and per-test pre/post steps (HTTP + assertions + extract)
- Summary with pass/fail and non-zero exit on failures
- JSON and JUnit report outputs (summary and detailed per-test)

### Adapters (import)
- Postman (v2.1 JSON)
- Insomnia (export JSON)
- HAR (HTTP Archive)
- OpenAPI (3.x)
- Bruno (minimal export)

CLI examples:

```
hydreq import postman path/to/collection.json > suite.yaml
hydreq import insomnia path/to/export.json > suite.yaml
hydreq import har path/to/archive.har > suite.yaml
hydreq import openapi path/to/spec.(yaml|json) > suite.yaml
hydreq import bruno path/to/export.json > suite.yaml
```

### Reports
- JSON, JUnit, and HTML detailed reports include per-test entries and suite summaries. HTML reports are theme-aware (same palette as the Web UI) and include donut charts, filters, and sticky headers.
- Using `--report-dir` generates timestamped per-suite artifacts and run-level (batch) artifacts: `run-<timestamp>.{json,xml,html}`.

### Example suites (at a glance)
- `testdata/example.yaml` — smoke and extraction
- `testdata/matrix.yaml` — matrix expansion
- `testdata/depends.yaml` — DAG scheduling
- `testdata/hooks.yaml` — HTTP hooks
- `testdata/sqlite.yaml` — SQL hooks
- `testdata/openapi.yaml` — OpenAPI validation
- `testdata/tags.yaml` — tags and slow example
- `testdata/retries.yaml` — retries with jitter
- `testdata/jsoncontains.yaml` — JSONContains
- `testdata/postgres.yaml` / `sqlserver.yaml` — DB examples (env DSNs)

---

## Contributing & development

### Local services
- Use docker-compose to bring up httpbin, Postgres, and SQL Server: `docker-compose up -d`
- Most example suites require `HTTPBIN_BASE_URL` to be set. Our helper scripts export it for you (defaulting to your local docker httpbin).

### Run everything locally (one command)

```
./scripts/local-ci.sh
```

This script runs unit tests, starts local services, runs DB tests (if env DSNs present), and executes all example suites. Containers are automatically stopped on exit; set `KEEP_SERVICES=1` to keep them running.

### Auth example (local)
To include `testdata/auth.yaml` in batch runs:

```
export DEMO_BEARER="my-demo-token"
export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
```

### Project layout
- `cmd/hydreq` — CLI entrypoint
- `internal/runner` — engine (scheduling, assertions, hooks, OpenAPI)
- `internal/webui` — local Web UI (SSE, embedded assets)
- `internal/report` — JSON/JUnit writers
- `internal/adapters` — postman/insomnia/har/openapi/bruno
- `pkg/models` — suite model types
- `testdata/` — example suites and OpenAPI specs
- `schemas/` — JSON Schema for suites
- `.vscode/` — schema mapping for VS Code
- `.copilot/` — authoring prompts for Copilot
- `scripts/` — local CI and helpers

### Editors & Copilot (contributors)
See [Copilot and editor support](#copilot-and-editor-support) for the end‑user guide. The repo ships the schema and prompts; contributors don’t need extra setup.

### Roadmap
Near‑term
- Reports in GUI (download JSON/JUnit artifacts)
- Tags filter and default-timeout UX polish and persistence in GUI
- Editor polish: collapse persistence, Convert… cleanup, DSN helpers docs, “Run with deps” badges
- YAML‑preserving save path (raw mode to keep comments/order)
- OAuth2 client credentials helper for suite auth

Medium‑term
- Results history in GUI and diffs between runs
- VS Code extension for inline runs and decorations
- HAR import enrichments (query/form/multipart mapping, baseUrl inference)
- Expanded OpenAPI hints and response schema diffs

Longer‑term
- gRPC testing (reflect/proto) and contract checks
- Official Docker image and GitHub Action for CI

---

## License

GNU GPLv3 © 2025 DrWeltschmerz and contributors. See the LICENSE file for details.


