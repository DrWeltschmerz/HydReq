# UI Refactor Plan: Theme Modularization (2025-10-02)

## Theme Split Summary
- All theme variable blocks moved from `themes.css` into individual files under `static/themes/`:
  - `base.css` (`:root`)
  - `dark.css` (`body.dark`)
  - `hack.css` (`body.hack`)
  - `catppuccin-mocha.css`, `catppuccin-latte.css`, `synthwave.css`, etc.
- `themes.css` now aggregates via `@import`.
- `app.css` only contains rules, not theme variables.
- Theme selector in `index.html` matches available themes.

## Conventions
- Add new themes by creating a file in `static/themes/` and adding an `@import` in `themes.css`.
- Theme variables must be scoped to either `:root` or `body.<theme>`.
- No duplication of theme variables in other CSS files.
- Theme selector options must match available theme files.
- Use class-based switching via `applyTheme()` in JS.

## Next Steps
- Expand theme support as needed (add more theme files).
- Optionally document theme tokens in `docs/web-ui.md`.
- Continue JS refactor: split large files, add tests for store and theme switching.

---

## Gaps and cleanup plan (Phase 0/1 follow-up)

Observations
# Web UI refactor plan

This plan proposes a pragmatic refactor of HydReq's Web UI to improve maintainability, reduce duplication, and keep current functionality intact.

## Goals

- Reduce duplication (single source for utilities, themes, and suites logic).
- Split monoliths into small modules with clear boundaries.
- Maintain zero-build development workflow initially; allow optional bundling later.
- Preserve existing URLs and DOM IDs to avoid backend changes.

## Options considered

1) Vanilla JS + HTMX/Alpine (no build or minimal build)
   - Pros: small surface, easy to adopt incrementally, keeps SSR/simple hosting.
   - Cons: Still global-by-default; SSE management remains custom.

2) Preact + htm + Vite + TypeScript
   - Pros: Strong component model, small runtime, typed contracts, CodeMirror integrations exist.
   - Cons: Introduces a dev build; more moving parts.

3) React/Vue/Svelte SPA
   - Pros: Rich ecosystem, routing, state mgmt.
   - Cons: Bigger footprint; larger migration and infra for bundles.

Recommendation: Option 2 (Preact + htm + Vite + TS) for the editor and suites components, but proceed in phases to keep current UI working during migration. Start with Option 1 patterns (modular vanilla) to re-establish boundaries, then pave the path to Preact as needed.

## Phased migration

  - Keep CSS/JS human-readable: prefer multiple short lines over single long lines.
  - Avoid excessive inline styles in JS. Prefer semantic classes and tokens.
  - Preserve indentation and spacing for diffs; wrap text where sensible.

Phase 0: Housekeeping (no behavior changes)
Central store usage
- hydreqStore is the single source of truth for suite/test state across views (suites list, runner log, editor quick-run).
- UI subscribes to store updates and patches in-place; hydration occurs on expand to avoid stale views.
- Badge/status classes are derived in a single place; components do not compute divergent logic.
- TODO: Add JS unit tests to cover store semantics (setTest, setSummary, derived badge) and subscription delivery.
- Remove dead/legacy files after verification: `internal/webui/static/suites.js`, `internal/webui/static/js/helpers.js`. (done)
- Move index.html inline `<style>` to `css/app.css`. (done)
- Consolidate theme tokens into `themes.css` and reference from `app.css`. (done — theme tokens have been moved to `themes.css` and `app.css` now references `themes.css` as the primary source for variables.)

Phase 1: Module boundaries (completed)
- Create `js/state/` with small modules:
  - `tags.js`: get/set, events, persistence. (done)
  - `env.js`: kv model + render mirroring. (done)
  - `run.js`: start/cancel run, SSE subscribe, event shapes. (done)
- Extract SSE listener from `js/suites.js` into `js/run-listener.js` with callbacks. (done — run-listener.subscribe now parses SSE and awaits async handlers; suites.js delegates to it and retains a fallback EventSource for compatibility.)
- Extract suites rendering into `js/suites-view.js`; keep the DOM IDs stable. (done)
- Extract user actions from `suites.js` to `js/suites-actions.js` (expand/collapse, new suite, import). (done)
- Extract DOM builders into `js/suites-dom.js` (test rows, header tags/env, stage rows, badge and details helpers). (done)
- Extract SSE wrapper into `js/suites-sse.js` and delegate from `listen()`. (done)
- Add `suites-api.js` with stable window-facing helpers; move remaining helpers from `suites.js` to shrink file size; keep back-compat stubs. (done)
- Add small DOM utilities (setFlexRow/Col, show/hide, buildDownloadMenu) to reduce inline styles and long lines. (done)
- Add server helper `POST /api/editor/checkpath` to validate client-proposed paths and report existence/safety. (done — supports the improved "New Suite" UX.)
- New Suite UX: promptNewSuite now uses server-side check and opens the editor in "create" mode when the target file does not exist; the editor now shows a clear "New suite" banner, uses "Create" button labels, re-validates and asks to confirm on overwrite/validation warnings. (done)
- Suite list details: Display test failure details below the test name, in a collapsed-by-default details/summary element with a scrollable, copy-friendly message block. (done)
- Editor details styling: Unified scrollable message block across quick-run and per-test details. (done)

Acceptance: suites list renders; SSE updates badges/progress as before; editor opens; quick-run works; New Suite flow presents a safer, validated create path; test details display clearly underneath the test name; suite list failure details are collapsed by default and expand on demand; message blocks are scrollable and easy to copy. Unit tests cover run-listener, suites-dom helpers, suites-sse wrapper, and suites-api hydration.

Note on componentization path (user-preferred)
- Consider Svelte + Vite + Tailwind (+ DaisyUI) + CodeMirror for component-based architecture. Keep current zero-build path running in parallel during migration.
- Hosting remains via Go static file server; Vite build outputs to `internal/webui/static/dist/` and index.html can conditionally load built assets.

Phase 2: Editor split (in progress)
- Split `js/editor.js` into submodules:
  - `editor/modal.js` (shell, open/close, density).
  - `editor/state.js` (normalize, working model, dirty tracking).
  - `editor/yaml.js` (CodeMirror setup, serialize/parse, theme sync).
  - `editor/forms/*.js` (suite, test, request, assert, retry, hooks, matrix, openapi).
  - `editor/run.js` (quick-run, SSE, badge propagation).
  - `editor/controls.js` (delegated run/validate/save; accepts a compact
    context object from editor.js to keep editor.js lean).
  - `editor/validation.js` (field validation helpers and wiring). [added]
  - `editor/run-ui.js` (quick-run UI preparation and event handlers). [added]
  - Add minimal unit tests for editor modal open/close and state changes.
   - New tests: `editor-dirty-suppression.spec.js` verifies that programmatic
     `setText+baseline` does not mark the editor dirty after save; also kept
     editor save tests working via local fallbacks when `controls.js` is not
     loaded in isolated jsdom runs.
- Keep a thin `editor/index.js` that stitches modules and exposes the same `openEditor()` API.

Acceptance: 4-column editor remains functional with real-time YAML sync; quick-run + validate OK; deletes update YAML and suites.

Notes on whitespace and readability
- Wrapped long lines across new modules to keep code readable and diffs friendly.
- Replaced inline style mutations with CSS classes where practical; remaining instances are TODO for Phase 0/1 follow-up.
- Removed duplicate helpers (local debounce/setVisualEnabled) in `editor.js`; rely on single implementations.
 - Delegated button handlers to `editor/controls.js`. Editor exposes a
   minimal context (getWorking, getSelIndex, getYamlText, getPath,
   collectFormData, serializeWorkingToYamlImmediate, quick-run helpers,
   dirty/close accessors). This keeps the orchestrator short.
 - Fixed post-save dirty flicker by introducing a brief suppression window
   around programmatic YAML updates (setText/baseline). `yaml.js` ignores
   change events until the window elapses. `yaml-control.js` sets the window
   on programmatic writes.
 - Provided local fallbacks for validate/save in `editor.js` so tests that
   load only `editor.js` still pass without pulling in `controls.js`.
 - Next: remove test fallbacks from `editor.js` and keep them in test-only
   helpers to ensure the orchestrator remains lean.
 - Fixed left column vertical fill by CSS-only changes (flex/min-height on
   `.ed-col`, `.ed-col-content`, `.ed-tests-panel`, `.ed-tests-list`).

Phase 3: TypeScript & build opt-in
- Adopt TypeScript gradually for new modules (state/contracts). Configure Vite for dev build that outputs to `internal/webui/static/dist/`.
- Keep current non-bundled files working; allow index.html to switch to `dist/` when present via `<script type="module">`.

Phase 4: Preact islands (optional)
- Wrap suites list and editor panes as Preact components, mounted into existing DOM anchors. Migrate state to TS modules.

## Contracts and data shapes

- SSE events:
  - batchStart { total }
  - suiteStart { name, path, total, stages: { [stage:string]: count } }
  - testStart { Name, Stage, path }
  - test { Name, Status, DurationMs, Stage, Messages, path }
  - suiteEnd { name, path, summary, tests? }
  - batchEnd, done, error
- Editor run API: POST /api/editor/testrun { parsed, env, runAll, testIndex?, includeDeps, includePrevStages }
- Save API: POST /api/editor/save { path, content }

## Testing strategy

- Keep Playwright/E2E focused on:
  - Suites list render and expand
  - Stage rows and progress for dependsOn = single stage 0
  - Badge propagation from SSE and editor quick-run
  - Tag chip ↔ checkbox sync
  - Env pills mirrored in header and aside
- Unit tests (small): factor logic (tags/env state) into pure functions. (in-progress — adding Node-based unit tests using Mocha + JSDOM under internal/webui/static/test to validate run-listener and suites flush behavior.)

## Risks and mitigations

- Drift between runner view and editor quick-run badges
  - Mitigate by centralizing status map in a single module and use events to sync.
- CSS theming drift
  - Single source of tokens and scoped classnames for editor vs runner.
- Bundle introduction friction
  - Keep no-build path working; gate new modules behind optional `<script type="module">` when built files exist.

## Done criteria for refactor

- No duplicate JS helpers; no dead files. (done)
- index.html has no inline styles; all CSS under `css/` or `editor.css`. (done)
- Themes defined once; editor and runner share tokens. (done)
- Suites and editor code split into modules; file sizes manageable (<500 lines typical per module). (partially done - Phase 1 complete, Phase 2 in progress)
- All previously fixed correctness issues (dependsOn single-stage, batch counters, suite badge stability, path-filtered events) remain green. (done)
- Run-listener robustness: add reconnection/backoff with exponential delay and unit tests. (done — subscribe() now reconnects with capped backoff and stops on unsubscribe; tests under internal/webui/static/test/*reconnect*.spec.js)
- Test details UX improvement: display details on a separate line underneath the test name. (done)
- Automated E2E tests for UI interactions and rendering. (in progress)

## Gaps and cleanup plan (Phase 0/1 follow-up)

Observations
- Some JS files remain large (e.g., `internal/webui/static/js/suites.js`, `editor.js`).
- A few inline style assignments are still present in JS (layout/margins), should be moved to CSS classes.
- Styles are largely centralized, but we still set ad-hoc style props (e.g., badge background colors) that should be expressed as classes/tokens.

Plan
0) Whitespace and readability policy
  - Keep CSS/JS human-readable: prefer multiple short lines over single long lines.
  - Avoid excessive inline styles in JS. Prefer semantic classes and tokens.
  - Preserve indentation and spacing for diffs; wrap text where sensible.
  - Theme variables formatted one per line; JS DOM builders avoid long chained statements.
1) Inline styles → CSS classes
  - Create utility classes in `app.css` for row spacing, padding, hover, and badge states.
  - Replace remaining `el.style.*` in `suites-view.js` and `suites.js` with class names.
  - Acceptance: grep shows zero remaining marginLeft/fontSize/position hot spots in UI JS (excluding tests).
2) Split large JS files
  - `suites.js`: extract `sse-handlers.js` (listen/handlers), `suite-state.js` (selection, lastStatus, buffering), `suite-dom.js` (DOM builders), keeping a thin orchestrator.
  - In progress: Extracted `suites-actions.js`. Next: move header renderers (renderHeaderTags/env) and store wiring to `suite-state.js`.
  - `editor.js`: continue Phase 2 split (modal, state, yaml, forms/*, run).
3) Status/badge CSS tokens (done)
  - Added unified classes: `.status-badge`, `.status-ok`, `.status-fail`, `.status-skip`, `.status-unknown`.
  - Replaced inline style updates across suites and editor with class-based updates and standardized icons: ✓ passed, ✗ failed, ○ skipped, · unknown.
4) Store-first state and buffering (done)
  - Introduced `hydreqStore` as a small central store for suite/test results with pub/sub.
  - Removed legacy pending buffers and the `flushPendingForPath` path from suites; rely on hydration from store when expanding suites, and on store subscription for incremental updates.
4) Tests
  - Add E2E for suite expand and details collapse/expand; verify scrollability and copy behavior.
5) Docs
  - Keep this plan and Summary of findings in sync; link classes and modules as they land.