# CLI

Run all suites (default):
```
./hydreq run --workers 4 -v
```

Run a specific suite:
```
./hydreq run -f testdata/example.yaml --workers 4 -v
```

Generate all report types with default names:
```
./hydreq run --report-dir reports
```
Per-suite: `<suite>-<timestamp>.{json,xml,html}`; batch: `run-<timestamp>.{json,xml,html}`.

Flags:
- `--file` (or `-f`): path to YAML suite (optional; when omitted, all suites under `testdata/` are run)
- `--workers`: concurrent workers per stage (default 4)
- `--tags`: comma-separated tag filter (any-of)
- `--default-timeout-ms`: default per-request timeout when `test.timeoutMs` is not set (default 30000)
- `--verbose` (or `-v`): verbose failure details
- `--report-json` / `--report-junit`: write detailed reports to files
- `--report-html`: write an HTML detailed report to a file
- `--report-dir`: if set and no explicit report paths are provided, writes JSON, JUnit, and HTML reports into this directory using `<suite-name>-<timestamp>.{json,xml,html}` and also emits aggregated run-level artifacts `run-<timestamp>.{json,xml,html}`
- `--output`: console output format: `summary` (default) or `json` (prints a detailed JSON result to stdout)

Exit codes:
- `0`: all tests passed
- `1`: tests failed
- `2`: suite failed to load or is not runnable (e.g., invalid YAML, missing baseUrl when tests use path-only URLs)

## Validator

Validate your suites against the JSON Schema to catch shape issues early:

```
go build -o bin/validate ./cmd/validate
./bin/validate -dir testdata -schema schemas/suite.schema.json
```

Flags:
- `-dir`: directory to scan for suites (default `testdata`)
- `-schema`: path to schema file (default `schemas/suite.schema.json`)
- `-quiet`: print only failures

The CI runs this validator as part of the examples job and fails on any invalid suite.

### Local CI toggles

The `scripts/local-ci.sh` helper supports two env toggles to experiment with validation + reporting locally:

- `SKIP_VALIDATION=1` — skip schema validation (not recommended for commits, but useful while authoring)
- `VALIDATION_WARN_ONLY=1` — run validation but do not fail the job on invalid suites; errors still appear in output

Example:
```
SKIP_VALIDATION=1 scripts/local-ci.sh
VALIDATION_WARN_ONLY=1 scripts/local-ci.sh
```

## Troubleshooting: suite load errors / not runnable

- Invalid YAML or wrong shape: the CLI prints a bold "suite load error" with the failing file and message. Fix the YAML or run the validator for details.
- Empty baseUrl with path-only request URLs: HydReq refuses to run the suite to avoid misleading request errors. Set `suite.baseUrl` (can reference `${ENV:...}`) or make URLs absolute.
