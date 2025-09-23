# Contributing & development

## Local services
Use docker-compose to bring up httpbin, Postgres, and SQL Server:
```
docker-compose up -d
```
Most example suites accept `HTTPBIN_BASE_URL`. Set it to target your local httpbin; our scripts export it automatically.

## Run everything locally (one command)
```
./scripts/local-ci.sh
```
This runs unit tests, starts local services (if available), DB tests (if DSNs present), and example suites.

## Auth example (local)
To include `testdata/auth.yaml` in batch runs:
```
export DEMO_BEARER="my-demo-token"
export BASIC_B64=$(printf 'user:pass' | base64 | tr -d '\n')
```

## Project layout
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

## Editors & Copilot (contributors)
See the end‑user guide: `README.md` → Copilot and editor support. The repo ships the schema and prompts.

## Roadmap
- OAuth2 client credentials helper
- Results history in GUI and diffs between runs
- VS Code extension for inline runs and decorations
- HAR import enrichments (query/form/multipart mapping, baseUrl inference)
- gRPC testing (reflect/proto) and contract checks
- Docker image and GitHub Action for CI
- Interactive YAML editing directly in the GUI (edit/save suites with schema hints)
