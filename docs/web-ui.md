# Web UI

- Launch: run `hydreq` with no arguments (or `hydreq gui`). The browser opens at `http://127.0.0.1:8787`.
- Controls: Only failed, Auto-scroll, Theme selector (light/dark and more), Stop. Keyboard shortcuts: r=run, s=stop, c=clear, f=only failed, d=dark.
- Suites: pick suites from `testdata/`, set Workers, optionally define Env overrides (KEY=VALUE, one per line).
- Streaming: Each test emits a start line and a result line; failures have expandable details.
- Summaries: Suite-level and final batch summary with pass/fail/skip.
- Artifacts: Prefer the CLI flags for generating JSON/JUnit/HTML reports as files you can archive in CI; see [Reports](reports.md).
- Editor: Click “Edit” next to a suite to open the Visual + YAML editor. See [Visual editor](visual-editor.md) for full details.
- Quick Run: Inside the editor, you can run the selected test (or the whole suite from the YAML tab), and optionally include `dependsOn` via “with deps”.
- The UI defaults to dark theme; density toggle and a resizable preview pane are available in the editor.
