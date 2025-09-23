# Authoring suites

Use YAML to describe tests. The repo ships `schemas/suite.schema.json` for validation and completions.

Validate from the command line:

```
go build -o bin/validate ./cmd/validate
./bin/validate -dir testdata -schema schemas/suite.schema.json
```

Tip: Run the validator before committing or wire it into pre‑commit hooks.

Preflight: baseUrl vs path URLs

- If your tests use path-only URLs (e.g., `/anything`, `/status/200`), set `suite.baseUrl` (it can be `${ENV:HTTPBIN_BASE_URL}`) so the CLI can resolve requests. Otherwise the suite is marked not‑runnable and will not execute.

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

## Validation and not-runnable

- Schema validation catches shape issues (unknown fields, wrong types) early.
- Engine preflight marks suites as not runnable when core conditions are missing (e.g., empty baseUrl with path-only URLs). Such suites will be listed under Not Run in batch reports and exit the CLI with code 2 when selected directly.
