# Getting started

HydReq is a lightweight API test runner with a Web UI and CLI. Author tests in YAML and run them locally or in CI.

## Install
- Download a prebuilt binary from Releases and unzip, or
- Build from source:
  - `go install github.com/DrWeltschmerz/HydReq/cmd/hydreq@latest`
  - or `go build -o bin/hydreq ./cmd/hydreq`

## Quick start (GUI)
1) Run `hydreq` with no args.
2) Browser opens at http://127.0.0.1:8787.
3) Select suites from `testdata`, set Workers, optionally provide KEY=VALUE env overrides, click Run.

## Quick start (CLI)
Run a suite:
```
./hydreq run -f testdata/example.yaml --workers 4 -v
```
Add reports:
```
./hydreq run -f testdata/example.yaml \
  --report-json report.json \
  --report-junit report.xml
```
