# Web UI

- Launch: run `hydreq` with no arguments (or `hydreq gui`). The browser opens at `http://127.0.0.1:8787`.
- To run with prepopulated environment variables from a `.env` file (in the same folder as the binary), use: `HYDREQ_ENV_UI=1 ./bin/hydreq gui --detach`.
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

## Theme system

- Theme variables are modularized: each theme (dark, hack, catppuccin, synthwave, etc.) lives in its own CSS file under `static/themes/` and is aggregated via `themes.css`.
- The theme selector in the header allows switching between all available themes; changes are instant and persistent.
- To add a new theme, create a CSS file in `static/themes/` and add an `@import` in `themes.css`.

## Architecture notes

- Store-first state: the suites/test statuses and messages flow through a central `hydreqStore` and a small suites-scoped state helper (`suites-state.js`). Views hydrate from the store when expanded and subscribe for incremental updates.
- Public API surface: `suites-api.js` exposes stable, window-scoped helpers used by the editor and other modules, such as `getSuiteLastStatus(path)`, `getSuiteSummary(path)`, `getSuiteBadgeStatus(path)`, `setSuiteTestDetails(path, name, messages)`, `setSuiteTestStatus(path, name, status)`, `hydrateFromSummary(path)`, and `expandSuiteByPath(path)`.
- Modularity: `suites.js` is now a thin orchestrator delegating DOM to `suites-dom.js`, SSE to `suites-sse.js`, state to `suites-state.js`, and public helpers to `suites-api.js`.
