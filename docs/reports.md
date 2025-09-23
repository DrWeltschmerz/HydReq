# Reports

HydReq can emit detailed results and theme-aware HTML pages you can share in CI artifacts.

- JSON report: summary + per-test entries (name, status, durationMs, messages)
- JUnit report: one <testcase> per test; failures include <failure>, skips include <skipped/>
- HTML report: a standalone web page with suite summary and a table of tests, styled with DaisyUI; includes donut chart, filters (search/status/Only failed), sticky headers, and collapsible messages. The report reads colors from the selected theme so visuals match the Web UI.

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

Artifacts created with `--report-dir`:
- Per-suite: `<suite>-<timestamp>.json`, `<suite>-<timestamp>.xml`, `<suite>-<timestamp>.html`
- Run-level (batch): `run-<timestamp>.json`, `run-<timestamp>.xml`, `run-<timestamp>.html`

## Viewing reports

- Open the generated .html files directly in your browser (double‑click or drag‑and‑drop).
- In CI, upload the reports directory as an artifact and download to view locally.
- The HTML includes a theme selector in the navbar (Light, Dark, Synthwave, Hack, Catppuccin), persisted via localStorage.

## Tips

- For a one‑liner that produces all artifacts, prefer `--report-dir`.
- Use `--workers` to speed up runs; the donut chart and stats reflect the final summary.
- Screenshots: capture the top section (stats + donut) and a few table rows; if helpful, switch to Dark/Light for contrast.
