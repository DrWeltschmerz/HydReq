# HydReq (Hydra Request)

[![CI](https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml/badge.svg)](https://github.com/DrWeltschmerz/HydReq/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/DrWeltschmerz/HydReq?include_prereleases&sort=semver)](https://github.com/DrWeltschmerz/HydReq/releases)
[![Downloads](https://img.shields.io/github/downloads/DrWeltschmerz/HydReq/total.svg)](https://github.com/DrWeltschmerz/HydReq/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

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

## Contents

- [For end users](#for-end-users)
	- [Quick start (GUI)](#quick-start-gui)
	- [Quick start (CLI)](#quick-start-cli)
	- [Install](#install)
	- [Using the Web UI](#using-the-web-ui)
	- [Using the CLI](#using-the-cli)
	- [Features](#features)
	- [Adapters (import)](#adapters-import)
	- [Reports](#reports)
	- [Example suites (at a glance)](#example-suites-at-a-glance)
- [Contributing & development](#contributing--development)
	- [Local services](#local-services)
	- [Run everything locally (one command)](#run-everything-locally-one-command)
	- [Auth example (local)](#auth-example-local)
	- [Project layout](#project-layout)
	- [VS Code & Copilot](#vs-code--copilot)
	- [Roadmap](#roadmap)
- [License](#license)

---

## For end users

### Quick start (GUI)

1) Download a prebuilt archive from the Releases page for your OS/arch.
2) Unzip and run the `hydreq` binary.
3) Your browser opens at http://127.0.0.1:8787.
	 - Left: select suites from `testdata`, set Workers, optional env overrides (KEY=VALUE).
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
- Controls: Only failed, Auto-scroll, Dark mode, Stop. Keyboard shortcuts: r=run, s=stop, c=clear, f=only failed, d=dark.
- Each test shows a blue “starting” line, then flips to ✓/✗/– when done. Failures include expandable details.
- A summary appears for every suite and a final batch summary aggregates pass/fail/skip.

### Using the CLI

- Run a suite: `./hydreq run -f testdata/example.yaml --workers 4 -v`
- Reports: add `--report-json report.json` and/or `--report-junit report.xml` for detailed outputs.

### Features
## Features
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
- JSON detailed and JUnit detailed reports include per-test entries and suite summaries.

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
- Most example suites accept `HTTPBIN_BASE_URL`. If you don’t set it, they default to the public httpbin.

### Run everything locally (one command)

```
./scripts/local-ci.sh
```

This script runs unit tests, starts local services, runs DB tests (if env DSNs present), and executes all example suites.

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

### VS Code & Copilot
- YAML schema mapping is provided in `.vscode/settings.json`.
- See `.copilot/README.md` for authoring tips.

### Roadmap
- OAuth2 client credentials helper
- Results history in GUI and diffs between runs
- VS Code extension for inline runs and decorations
- HAR import enrichments (query/form/multipart mapping, baseUrl inference)
- gRPC testing (reflect/proto) and contract checks
- Docker image and GitHub Action for CI
- Interactive YAML editing directly in the GUI (edit/save suites with schema hints)

## License

GNU GPLv3 © 2025 DrWeltschmerz and contributors. See the LICENSE file for details.

## Using the tool

Tip: Running `hydreq` with no arguments launches the local Web UI at http://127.0.0.1:8787. Use the `run` subcommand for scripts/CI.

### Web UI quick guide
- Left panel: Refresh rescans `testdata` for `*.yaml` suites. Select one or more suites, set Workers, optionally add env overrides (KEY=VALUE) for this run.
- Right panel: Progress bars for batch/suite/stages. The console shows per-test start lines and results; failed tests include collapsible details. Only failed, Auto-scroll, Dark, and Stop are available; keyboard shortcuts: r/s/c/f/d.

## Quick start

Build and run the example suite:

```
go build -o bin/hydreq ./cmd/hydreq
./bin/hydreq run -v --file testdata/example.yaml --workers 4 --report-json report.json --report-junit report.xml
```

### Use a local httpbin (recommended)

All example suites accept `HTTPBIN_BASE_URL`. To avoid hitting the public httpbin, run a local instance and point tests at it:

```
docker-compose up -d httpbin
export HTTPBIN_BASE_URL=http://localhost:8080

# Run any suite against local httpbin
./bin/hydreq run -f testdata/example.yaml --workers 4
```

### Run everything locally (one command)

Run unit tests, start local services (httpbin, Postgres, MSSQL), run DB integration tests, and execute all example suites (including auth) in one go:

```
./scripts/local-ci.sh
```

Notes:
- Requires Docker + docker-compose to run service containers. If unavailable, it will still run unit tests and non-DB examples.
- Auth examples are enabled by default via `ENABLE_DEMO_AUTH=1`. Set `ENABLE_DEMO_AUTH=0` to skip providing demo creds.

Example suite (`testdata/example.yaml`):

```
name: httpbin smoke
baseUrl: ${ENV:HTTPBIN_BASE_URL}
vars:
	token: demo123
	HTTPBIN_BASE_URL: https://httpbin.org

tests:
	- name: GET status 200
		request:
			method: GET
			url: /status/200
		assert:
			status: 200
			maxDurationMs: 3000

	- name: echo headers
		request:
			method: GET
			url: /headers
			headers:
				Authorization: "Bearer ${token}"
		assert:
			status: 200
			jsonContains:
				headers.Authorization: "Bearer ${token}"

	- name: post json and extract
		request:
			method: POST
			url: /anything
			body:
				user: qa
				id: 42
		assert:
			status: 200
			jsonEquals:
				json.user: qa
				json.id: "42"
		extract:
			echoedUser:
				jsonPath: json.user

	- name: reuse extracted var
		request:
			method: POST
			url: /anything
			body:
				who: "${echoedUser}"
		assert:
			status: 200
			jsonEquals:
				json.who: qa
```

## Flags
- run
	- --file: path to YAML suite (default: testdata/example.yaml)
	- -v, --verbose: verbose failure details (response body, assertion messages)
	- --tags: comma-separated tag filter (any-of)
	- --workers: number of concurrent workers per stage (default 4)
	- --default-timeout-ms: default per-request timeout when test.timeoutMs is not set (default 30000)
	- --report-json: write JSON report to file path (detailed)
	- --report-junit: write JUnit XML report to file path (detailed)

## Exit codes
- 0: all tests passed
- 1: tests failed
- 2: suite load error

## Matrix example

```
./bin/hydreq run --file testdata/matrix.yaml --workers 4
```

This expands each test across the cartesian product of matrix variables and appends a suffix to the test name, e.g.:

- POST echoes matrix json [color=red,size=S]
- POST echoes matrix json [color=blue,size=M]

### Matrix testing explained

Matrix lets you run the same logical test with multiple variable combinations without copy/paste.

- In YAML, add a `matrix:` section to a test where each key has an array of values.
- The runner computes the cartesian product of all keys, producing one concrete test per combination.
- Each concrete test receives those key/value pairs as variables, so you can reference them in URL, headers, query, body, or assertions with `${var}`.
- The test name gets a suffix like `[k1=v1,k2=v2]` for clarity in output and reports.

Example:

```
tests:
	- name: POST echoes matrix json
		request:
			method: POST
			url: /anything
			body:
				color: "${color}"
				size: "${size}"
		assert:
			status: 200
			jsonEquals:
				json.color: "${color}"
				json.size: "${size}"
		matrix:
			color: [red, blue]
			size: [S, M]
```

This yields four tests:
- POST echoes matrix json [color=red,size=S]
- POST echoes matrix json [color=red,size=M]
- POST echoes matrix json [color=blue,size=S]
- POST echoes matrix json [color=blue,size=M]

Tips:
- You can combine matrix with `vars:` (test-level) to add extra constants.
- Matrix vars are available for interpolation anywhere strings are used.
- Use `--workers` to speed up execution; combinations are independent and can run in parallel.

## Ordering: stages and dependsOn

- Stage-based: use integer `stage` to group tests that can run concurrently.
	- All tests in the same stage run concurrently.
	- Variables extracted in a stage become available to later stages.
	- Place producer tests (that extract) in an earlier stage than consumers.

- Dependency-based: use `dependsOn: [test names]` to form a DAG.
	- The runner schedules layers automatically; failures propagate and block dependents (which are then skipped).
	- Duplicate test names are not allowed when using dependsOn (names must be unique).
	- Tag/skip filters are applied first; if a dependency is filtered out, dependents are also skipped.

## DependsOn example

```
./bin/hydreq run --file testdata/depends.yaml --workers 4
```

YAML:

```
tests:
	- name: create id
		request: { method: POST, url: /anything, body: { id: "${seedId}" } }
		assert:
			status: 200
			jsonEquals:
				json.id: "${seedId}"
		extract:
			prevId: { jsonPath: json.id }

	- name: reuse extracted id
		dependsOn: ["create id"]
		request: { method: POST, url: /anything, body: { prev: "${prevId}" } }
		assert:
			status: 200
			jsonEquals:
				json.prev: "${prevId}"
```

## Detailed reports

- JSON detailed: suite, summary, and array of per-test entries with name, status, durationMs, messages.
- JUnit detailed: each test becomes a <testcase>; failures include a <failure message> and skips a <skipped/>.

Example generation:

```
./bin/hydreq run --file testdata/example.yaml --report-json report.json --report-junit report.xml
```

## Install

### Prebuilt binaries (recommended)

Download the latest release for your OS from the Releases page and unzip. The archive includes examples, README, VS Code schema mapping, and Copilot prompts.

### From source

Install from source or build a binary:

```
go install github.com/DrWeltschmerz/HydReq/cmd/hydreq@latest   # installs hydreq in your GOPATH/bin
# or
go build -o bin/hydreq ./cmd/hydreq
```

## Hooks

Hooks let you run lightweight steps before/after the suite and around each test. Hooks can:
- set/mutate variables (vars)
- perform an HTTP request (request) with assertions and extractions

Suite-level hooks:

```
preSuite:
	- name: init
		vars:
			token: demo-token

postSuite:
	- name: finalize
		vars:
			done: yes
```

Per-test hooks:

```
tests:
	- name: example with hooks
		pre:
			- name: set local var
				vars:
					local: hook-value
		request: { method: GET, url: /headers }
		assert: { status: 200 }
		post:
			- name: verify via POST
				request:
					method: POST
					url: /anything
					body:
						echo: ok
				assert:
					status: 200
					jsonEquals:
						json.echo: ok
```

Notes:
- Hooks run sequentially and can mutate the shared variable map.
- Post hooks run only if the test passed.
- Hook HTTP steps are executed like tests (assertions/extract supported) but are not counted in the summary totals.

## SQL hooks

Use SQL in hooks to seed/read external state during tests. For local dev, sqlite works out of the box. Postgres and SQL Server are also supported.

Example (`testdata/sqlite.yaml`):

```
preSuite:
	- name: create table
		sql:
			driver: sqlite
			dsn: file:./qa.sqlite?cache=shared
			query: |
				CREATE TABLE IF NOT EXISTS notes (
					id TEXT PRIMARY KEY,
					content TEXT,
					created TEXT
				);

tests:
	- name: insert and select
		pre:
			- name: insert row
				sql:
					driver: sqlite
					dsn: file:./qa.sqlite?cache=shared
					query: |
						INSERT INTO notes(id, content, created) VALUES ('${FAKE:uuid}', 'hello ${RANDINT:1:9}', '${NOW:2006-01-02T15:04:05Z07:00}');
			- name: read one
				sql:
					driver: sqlite
					dsn: file:./qa.sqlite?cache=shared
					query: |
						SELECT id, content, created FROM notes ORDER BY created DESC LIMIT 1;
					extract:
						lastId: id
						lastContent: content
```

## Data generators

You can embed dynamic data into strings anywhere interpolation works:

- `${FAKE:uuid}`: random UUID v4
- `${EMAIL}`: random email like `qa-<hex>@example.com`
- `${NOW:<layout>}`: current time formatted with Go layout (e.g., `${NOW:2006-01-02}`)
- `${NOW+/-offset:<layout>}`: time offset by s/m/h/d/w (e.g., `${NOW+1d:2006-01-02}`)
- `${RANDINT:min:max}`: random integer in [min, max]

## Adapters (import)

- Postman (v2.1 JSON): converted to a Suite with basic assertions.
- Insomnia (export JSON): request resources become TestCases.
- HAR (HTTP Archive): entries become TestCases with default status=200.
- OpenAPI (3.x): operations become TestCases with default expected status.

CLI import:

```
hydreq import postman path/to/collection.json > suite.yaml
hydreq import insomnia path/to/export.json > suite.yaml
hydreq import har path/to/archive.har > suite.yaml
hydreq import openapi path/to/spec.(yaml|json) > suite.yaml
hydreq import bruno path/to/export.json > suite.yaml
```

Adapter notes:
- Postman/Insomnia: Only a subset is mapped (basic method/url/headers/body). Review and refine assertions.
- HAR: Uses request URL, headers, and postData.text (if present). Default assert status=200.
- OpenAPI: Generates a skeleton per operation (no sample bodies). Picks 200 if available, else first numeric response code.
- Bruno: Minimal support for a flattened export with requests [{name,method,url,headers,body}]. Treats each as a test with default status=200.

## OpenAPI

Enable schema validation per suite/test to fail fast on schema drift. See `testdata/openapi.yaml` and `testdata/specs/openapi.yaml`.

Notes:
- Only JSON responses are validated (based on Content-Type).
- Paths are matched using kin-openapi router against the request path.
- Enable/disable per test via `openApi.enabled: true|false`.

### SQL driver DSNs

- sqlite: `file:./qa.sqlite?cache=shared`
- Postgres (pgx): `postgres://user:pass@host:5432/db?sslmode=disable`
- SQL Server (sqlserver): `sqlserver://user:pass@host:1433?database=db`

## OnResult callback (embedding)

If you embed runner in another Go program, you can capture per-test results:

```go
sum, err := runner.RunSuite(ctx, suite, runner.Options{
	OnResult: func(tr runner.TestResult) {
		// tr.Name, tr.Status (passed|failed|skipped), tr.DurationMs, tr.Messages
	},
})
```

## Recipes

- Only run smoke tests: `./bin/hydreq run -f suite.yaml --tags smoke`
- Increase parallelism: `./bin/hydreq run -f suite.yaml --workers 8`
- Retries with jitter:
	```
	tests:
	  - name: flaky GET
	    request: { method: GET, url: /status/200 }
	    assert: { status: 200 }
	    retry: { max: 3, backoffMs: 200, jitterPct: 25 }
	```
- Per-test timeout: set `timeoutMs` in a test.
- DAG scheduling:
	```
	tests:
	  - name: create
	    request: { method: POST, url: /anything, body: { id: 1 } }
	    assert: { status: 200 }
	  - name: use
	    dependsOn: [create]
	    request: { method: POST, url: /anything, body: { ref: 1 } }
	    assert: { status: 200 }
	```

## Troubleshooting

- Requests fail or hang: check proxies, DNS, and timeouts (configure `timeoutMs`).
- SQLite “no such table”: when using separate hooks, prefer a file DSN over in-memory to persist across connections.
- SQL DSN errors: verify `driver` matches DSN (sqlite/pgx/sqlserver) and credentials are correct.
- OpenAPI route not found: ensure path (without baseUrl) matches the spec and method is correct.
- Auth suite skipped in scripts: set `DEMO_BEARER` or `BASIC_B64` env vars to include `testdata/auth.yaml` in example runs (see below).

## Auth suite (enable locally)

The auth example (`testdata/auth.yaml`) verifies Authorization headers coming from env variables. To include it in batch runs and avoid skips:

```
# optionally run local httpbin
docker-compose up -d httpbin
export HTTPBIN_BASE_URL=http://localhost:8080

# set one or both env vars used in the suite
export DEMO_BEARER="my-demo-token"
# BASIC_B64 is base64 of user:pass
export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')

# run the auth suite directly
./bin/hydreq run -f testdata/auth.yaml

# or include it when running all examples (set ENABLE_DEMO_AUTH to auto-provide demo creds)
ENABLE_DEMO_AUTH=1 ./scripts/run-examples.sh
```

Notes:
- The suite asserts httpbin echoes Authorization; it does not contact any real auth server.
- The example runner script skips `auth.yaml` unless `DEMO_BEARER` or `BASIC_B64` is set.
	- You can set `ENABLE_DEMO_AUTH=1` to have the script auto-set `DEMO_BEARER` (demo-token) and a `BASIC_B64` value for local runs.

## Development & contribution

### Project layout

- `cmd/hydreq`: CLI entrypoint and command wiring
- `internal/runner`: suite execution engine (scheduling, assertions, hooks, OpenAPI)
- `internal/httpclient`: thin HTTP client wrapper
- `internal/report`: JSON/JUnit writers
- `internal/adapters`: import adapters (postman/insomnia/har/openapi/bruno)
- `internal/webui`: browser UI server (SSE streaming, embedded assets)
- `pkg/models`: YAML suite models
- `scripts/`: local automation (examples runner, local CI)
- `testdata/`: example suites and OpenAPI specs
- `docker-compose.yml`: local services (httpbin, Postgres, MSSQL)

### CI and local automation

- GitHub Actions: see `.github/workflows/ci.yml`.
	- Default job runs `go test ./...`.
	- Postgres and SQL Server jobs spin up service containers and run integration tests with DSNs.
	- Examples job runs example suites against local httpbin + DB services and includes auth (via ENABLE_DEMO_AUTH=1).

- Local mirror: `scripts/local-ci.sh`
	- Runs unit tests.
	- If Docker + docker-compose are available, starts httpbin, Postgres, and MSSQL via `docker-compose.yml`, waits for readiness, exports env vars, runs integration tests, and then runs example suites against local httpbin (auth enabled by default).

Optional local commands:

```
# Bring up DBs for examples/integration tests
docker-compose up -d

# Run integration tests (env-gated)
PG_DSN=postgres://postgres:password@localhost:5432/qa?sslmode=disable \
MSSQL_DSN=sqlserver://sa:Your_password123@localhost:1433?database=master \
go test -run 'Test(PG|MSSQL)Integration' -v ./internal/runner
```

## Try more examples

- Tags filter:
	- `./bin/hydreq run -f testdata/tags.yaml --tags smoke`
- Retries/backoff:
	- `./bin/hydreq run -f testdata/retries.yaml`
- JSONContains:
	- `./bin/hydreq run -f testdata/jsoncontains.yaml`
- Auth (set env first):
	- export DEMO_BEARER="abc123"
	- export BASIC_B64=$(printf 'user:pass' | base64)
	- `./bin/hydreq run -f testdata/auth.yaml`

### Examples overview

- `testdata/example.yaml`: basic smoke (status/header/json), extraction and reuse
- `testdata/matrix.yaml`: data-driven matrix expansion across variables
- `testdata/depends.yaml`: DAG scheduling via dependsOn
- `testdata/hooks.yaml`: pre/post HTTP hooks with assertions and extraction
- `testdata/sqlite.yaml`: SQL hooks (sqlite) to seed/read state
- `testdata/openapi.yaml`: OpenAPI 3.x response validation
- `testdata/tags.yaml`: tag filtering and a slow example
- `testdata/retries.yaml`: retries with backoff/jitter; success path
- `testdata/jsoncontains.yaml`: body and JSONPath substring checks
- `testdata/postgres.yaml`: Postgres example (requires PG_DSN)
- `testdata/sqlserver.yaml`: SQL Server example (requires MSSQL_DSN)
- `testdata/recipes-*.yaml`: small, focused recipes for quick copy/paste

### Copilot and editor support

- JSON Schema for validation and completions: `schemas/suite.schema.json`
- Copilot authoring guide: `.copilot/prompts/suite.prompts.md` (open alongside your YAML to steer suggestions)
- VS Code: see `.copilot/README.md` for a `yaml.schemas` snippet to enable schema-based validation and better completions.
