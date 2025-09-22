# Reports

HydReq can emit detailed results:

- JSON report: summary + per-test entries (name, status, durationMs, messages)
- JUnit report: one <testcase> per test; failures include <failure>, skips include <skipped/>

Generate:
```
./hydreq run -f testdata/example.yaml \
  --report-json report.json \
  --report-junit report.xml
```
