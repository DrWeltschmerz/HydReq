# Authoring suites

Use YAML to describe tests. The repo ships `schemas/suite.schema.json` for validation and completions.

> A practical overview is in the single [USER_GUIDE](./USER_GUIDE.md). Use this page for deeper authoring patterns and examples.
## VS Code + Copilot setup

Prereqs
- Install the YAML extension (ms-azuretools.vscode-yaml) for validation/completions.
- Open this repo (or copy `schemas/` and `.copilot/` into your project).

Schema binding
- This repo ships `.vscode/settings.json` that maps `schemas/suite.schema.json` to common `*.yaml` locations.
- For your own workspace, add:

```jsonc
"yaml.schemas": {
  "./schemas/suite.schema.json": [
    "suite.hrq.yaml",
    "suites/**/*.hrq.yaml",
    "**/hydreq*.hrq.yaml"
  ]
}
```

## Authoring flow
1. Open your suite YAML next to `.copilot/prompts/suite.prompts.md` so Copilot reads project idioms.
2. Start with one clean example test; then ask Copilot to generate similar ones (matrix, retries, negative cases).
3. Use hover on keys to see allowed values; fix squiggles early (the schema powers validation).
4. Use generators and variables: `${ENV:VAR}`, `${FAKE:uuid}`, `${RANDINT:min:max}`.
5. For OpenAPI specs, set `openApi: { file, enabled: true }` to get schema-informed suggestions and examples.

## Run from VS Code or CLI
- Task: “hydreq: Run current suite” is available (see `.vscode/tasks.json`). Open a YAML suite and run the Task (Terminal → Run Task...).
- CLI: `./bin/hydreq run -f <path/to/suite.hrq.yaml>`

## Validation
Validate from the command line:

```
go build -o bin/validate ./cmd/validate
./bin/validate -dir testdata -schema schemas/suite.schema.json
```

Tip: Run the validator before committing or wire it into pre‑commit hooks.

### Preflight: baseUrl vs path URLs
- If your tests use path-only URLs (e.g., `/anything`, `/status/200`), set `suite.baseUrl` (it can be `${ENV:HTTPBIN_BASE_URL}`) so the CLI can resolve requests. Otherwise the suite is marked not‑runnable and will not execute.
- Schema validation catches shape issues (unknown fields, wrong types) early.
- Engine preflight marks suites as not runnable when core conditions are missing (e.g., empty baseUrl with path-only URLs). Such suites will be listed under Not Run in batch reports and exit the CLI with code 2 when selected directly.

## Cheatsheets
- [Suite cheatsheet](../docs/cheatsheets/suite.cheatsheet.md)
- [Assertions cheatsheet](../docs/cheatsheets/assertions.cheatsheet.md)

## After a run
- Generate a PR-ready summary from JSON report:
  - `scripts/pr-summary.sh path/to/report.json`
- Get a checklist of suggested assertions (starter block):
  - `scripts/suggest-assertions.sh <reports-dir>` (uses latest `*.json`)
- Post a PR comment (requires gh):
  - `scripts/post-pr-summary.sh <pr-number-or-url> path/to/report.json`
- Compare two report JSONs:
  - `scripts/compare-reports.sh old.json new.json`

### CI integration
This project's CI automatically posts PR summaries, but you can set up similar automation in your own repo using the bundled scripts. Add a GitHub Actions job that runs batch tests, generates a summary with `scripts/pr-summary.sh`, and posts it via `gh pr comment`. See this project's `.github/workflows/ci.yml` for an example.

## Tips
- Indentation matters for `request.body`. Ensure nested fields are under `body:`.
- Use `stage` for coarse ordering; `dependsOn` for precise DAGs.
- Prefer matrix to avoid duplicative tests; reuse `${var}` in request/assert.

## Variables and interpolation
- `${ENV:VAR}` reads environment variables.
- Extracted vars can be reused in later tests or stages.

## Data generators
- `${FAKE:uuid}` — random UUID v4
- `${EMAIL}` — random email like `qa-<hex>@example.com`
- `${NOW:<layout>}` — Go time layout; e.g., `${NOW:2006-01-02}`
- `${NOW+/-offset:<layout>}` — offset by s/m/h/d/w; e.g., `${NOW+1d:2006-01-02}`
- `${RANDINT:min:max}` — random integer in [min, max]

## Matrix expansion
Define a `matrix:` with arrays to generate cartesian combinations. Each combo becomes a concrete test.

## Tags
Add `tags: [smoke, slow]` per test and filter with `--tags`.

## YAML tips
- Use spaces, not tabs. The Web UI editor auto-converts tabs to spaces and the validator will hint when tabs are detected.
- Quote strings that look like booleans or numbers (e.g., "on", "yes", "00123") to avoid unintended type coercion.
- Prefer minimal YAML: omit empty arrays/objects; unset fields are dropped on save.

## JSONPath (gjson) tips
- Use dot notation (`data.items.0.id`) or bracket for special keys (`data["x-y"].id`).
- For arrays, `@this` and functions like `#` (length) are supported by gjson; validate extract paths via Quick Run.
