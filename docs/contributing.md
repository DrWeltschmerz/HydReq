# Contributing & development

## Local services
Use docker-compose to bring up httpbin, Postgres, and SQL Server:
```
docker-compose up -d
```
Most example suites require `HTTPBIN_BASE_URL` to be set. Our helper scripts export it for you (defaulting to your local docker httpbin).

## Run everything locally (one command)

```
./scripts/local-ci.sh
```

This script runs unit tests, starts local services, runs DB tests (if env DSNs present), and executes all example suites. Containers are automatically stopped on exit; set `KEEP_SERVICES=1` to keep them running.
It also validates all example suites against the schema up front and fails fast on shape errors.

Toggles
- `SKIP_VALIDATION=1` — skip schema validation (useful when testing validation failures via CLI separately).
- `VALIDATION_WARN_ONLY=1` — keep running even if validation fails; prints a warning. Handy to exercise CLI reporting for not-run suites while still producing batch artifacts.

## Auth example (local)
To include `testdata/auth.yaml` in batch runs:

```
export DEMO_BEARER="my-demo-token"
export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
```

## Project layout
- `cmd/hydreq` — CLI entrypoint
 - `cmd/validate` — schema validator for suites
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

## Editors & Copilot (contributors)
See the end‑user guide: `README.md` → Copilot and editor support. The repo ships the schema and prompts; contributors don’t need extra setup.

## Roadmap
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
