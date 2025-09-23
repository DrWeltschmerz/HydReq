# Reports

HydReq can emit detailed results:

- JSON report: summary + per-test entries (name, status, durationMs, messages)
- JUnit report: one <testcase> per test; failures include <failure>, skips include <skipped/>
 - HTML report: a standalone web page with suite summary and a table of tests

Generate:
```
./hydreq run -f testdata/example.yaml \
  --report-json report.json \
  --report-junit report.xml
```

HTML report:
```
./hydreq run -f testdata/example.yaml \
  --report-html report.html
```

Or let the tool generate all three with timestamped names:
```
./hydreq run -f testdata/example.yaml \
  --report-dir reports
```
