# Getting started

HydReq is a lightweight API test runner with a Web UI and CLI. Author tests in YAML and run them locally or in CI.

## Install

Choose one of the following methods:

### 1. Docker (Recommended for quick start)
```bash
# Run the Web UI
docker run -p 8787:8787 ghcr.io/drweltschmerz/hydreq:latest

# Run tests
docker run -v $(pwd)/testdata:/testdata \
  ghcr.io/drweltschmerz/hydreq:latest \
  run -f /testdata/example.yaml -v
```

See [Docker documentation](docker.md) for more details.

### 2. Prebuilt Binaries
- Download from [Releases](https://github.com/DrWeltschmerz/HydReq/releases) and unzip

### 3. From Source
```bash
go install github.com/DrWeltschmerz/HydReq/cmd/hydreq@latest
# or
go build -o bin/hydreq ./cmd/hydreq
```

## Quick start (GUI)
1) Run `hydreq` with no args.
2) Browser opens at http://127.0.0.1:8787.
3) Select suites from `testdata`, set Workers, optionally provide KEY=VALUE env overrides, click Run. Active tags and env overrides appear as small pills next to Batch progress.

## Quick start (CLI)
Run all suites (default):
```
./hydreq run --workers 4 -v
```
Run a suite:
```
./hydreq run -f testdata/example.yaml --workers 4 -v
```
Add reports:
```
./hydreq run -f testdata/example.yaml \
  --report-json report.json \
  --report-junit report.xml \
  --report-html report.html
```

Or generate a full set (JSON/JUnit/HTML) plus run-level artifacts in a directory:
```
./hydreq run -f testdata/example.yaml --report-dir reports
```

Run all suites and auto-generate all report types (default names):
```
./hydreq run --report-dir reports
```
This writes per-suite `<suite>-<timestamp>.{json,xml,html}` and a batch `run-<timestamp>.{json,xml,html}`. You don’t need to pass individual `--report-*` flags when using `--report-dir`.

Notes:
- dependsOn chains are visualized as a single stage (0) to avoid confusing multi-stage bars for DAGs; execution order still honors dependencies.
- Inside the editor’s Quick Run, “with deps” runs the selected test with its dependency chain. “with previous stages” runs all tests from earlier stages before the selected test.
