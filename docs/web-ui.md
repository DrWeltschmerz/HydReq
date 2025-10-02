# Web UI

- Launch: run `hydreq` with no arguments (or `hydreq gui`). The browser opens at `http://127.0.0.1:8787`.
- Controls: Only failed, Auto-scroll, Theme selector (light/dark and more), Stop. Keyboard shortcuts: r=run, s=stop, c=clear, f=only failed, d=dark.
- Suites: pick suites from `testdata/`, set Workers, optionally define Env overrides (KEY=VALUE, one per line).
- Streaming: Each test emits a start line and a result line; failures have expandable details.
- Summaries: Suite-level and final batch summary with pass/fail/skip.
- Artifacts: Prefer the CLI flags for generating JSON/JUnit/HTML reports as files you can archive in CI; see [Reports](reports.md).
- Editor: Click “Edit” next to a suite to open the Visual + YAML editor. See [Visual editor](visual-editor.md) for full details.
- Quick Run: Inside the editor, you can run the selected test (or the whole suite), and optionally:
	- Include dependency chain via “with deps” (runs selected test and its `dependsOn` chain).
	- Include all tests from previous stages via “with previous stages”.
- The UI defaults to dark theme; density toggle and a resizable preview pane are available in the editor.

## Visual cues

- Active environment overrides and tag filters appear as small pills near the Batch progress header and in the sidebar.
- Tag chips shown on suite/test rows are clickable; they stay in sync with the sidebar tag checkboxes.
- For dependsOn-based suites, stage progress is shown as a single stage (0); totals and progress are still accurate.
