# Authoring suites

Use YAML to describe tests. The repo ships `schemas/suite.schema.json` for validation and completions.

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
