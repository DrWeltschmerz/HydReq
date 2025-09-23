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
- `2`: suite load error
