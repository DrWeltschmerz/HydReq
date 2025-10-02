# Web UI audit (current state)

This audit documents the current static Web UI, highlights duplication and structural issues, and pinpoints concrete lines/areas to improve during a refactor. Scope is `internal/webui/static/*`.

## Top-level structure

- index: `internal/webui/static/index.html`
- JS: `internal/webui/static/js/{app.js, suites.js, editor.js, utils.js, helpers.js}`
- CSS: `internal/webui/static/{css/app.css, components.css, layout.css, themes.css, editor.css}`
- Duplicates present: `internal/webui/static/suites.js` (old) vs `internal/webui/static/js/suites.js` (current); `internal/webui/static/js/helpers.js` overlaps with `js/utils.js` and top-level `utils.js` logic.

## index.html findings

- Lines 1–40: CDN links for DaisyUI and CodeMirror are inlined. Good for simplicity; consider vendoring/pinning via build tool later.
- Lines 15–20: Custom stylesheets are included; token/theme definitions are also duplicated across `app.css` and `themes.css`.
- Lines 23–29: JS includes load all modules as globals in this order: utils → suites → editor → app. Tight coupling via globals is required in this pattern.
- Lines 31–83: An inline `<style>` block defines toolbar layout and responsive rules. This should be moved to `css/app.css` to avoid split styling sources.
- Body → header (lines ~90–132): Toolbar controls (auto-refresh, only failed, theme, Run/Stop). Minimal ARIA roles; decent keyboard shortcuts.
- Aside (lines ~140–197): Workers/Timeout controls, Tag and Env editors (div-based Key/Value and checkboxes), Import UI, Suites section with toolbar.
- Section (lines ~198–257): Batch/Suite progress, active env/tag “pills”, stages, results area, and downloads.
- Footer script (lines ~262–292): Captures DOM nodes and calls `initSuites()`; some globals are repeated and also re-initialized inside JS modules.

Issues:
- Inline `<style>` creates split-of-concern with `css/app.css`.
- Multiple globals are referenced here and inside `app.js` (currentSuiteEl, batchBar, etc.) — easy to drift.

## js/app.js

Role: Bootstraps the app, theme + tag/env editors, auto-refresh, keyboard shortcuts, run downloads, and E2E debug hooks.

Notable points:
- Lines 1–16: Boot probes (for E2E), direct DOM appends into `#results`.
- Theme handling: `applyTheme` from utils; persists in localStorage.
- Tags editor: `readTagState`/`writeTagState` maintain both a chips view and a checkbox list; fires `hydreq:tags-changed`. Sync logic is duplicated in `suites.js`.
- Env overrides: KV rows with live mirror to header+aside via `renderActiveEnv`.
- Auto-refresh loop for suites list, persisted toggle.
- Keyboard shortcuts: r/s/c/f/d.
- E2E helpers: `__E2E_startRun` mirrors runner POST and calls `listen`.
- Debug markers periodically append content to `#results`.

Issues:
- Monolithic: themes, tags, env, auto-refresh, keyboard, downloads all in one file.
- Debug text writing into `#results` mixes concerns with runner output.
- Re-implements small utilities that also live in `utils.js`.

## js/suites.js (current)

Role: Suites list rendering, selection, delete/download/edit actions, and SSE listener with per-suite/stage/test badge updates.

Highlights:
- Maintains selection and open suites in localStorage; renders tag chips for suites/tests.
- SSE: Filters `testStart`/`test` events by `payload.path` to avoid cross-suite contamination.
- Stage rows created from `suiteStart` `stages` map; supports dynamic stage rows if a DAG introduced new layers.
- Progress increments only for tests that actually started; fallback path if `testStart` missed.
- Updates suite badges with priority failed > passed > skipped; final status comes from `suiteEnd`.
- Caches last statuses to pre-populate the editor quick-run panel.

Recent correctness fixes:
- For dependsOn/DAG, stages are flattened to a single stage (0) on the backend; FE renders stage 0 only.
- SSE payloads include `path`, used to ignore unrelated events.
- Batch-level counts rely on suite summaries to avoid double counting.

Issues:
- File is large and mixes:
  - Suites list rendering
  - SSE wiring
  - Per-test badge logic across multiple suites
  - Selection state, tag chip click handlers
- Contains DOM queries by selector strings scattered throughout; brittle to layout changes.

Duplication:
- There is also `internal/webui/static/suites.js` (older, different responsibilities and APIs). Risk of confusion and accidental inclusion.

## js/editor.js

Role: Editor modal with 4-column layout (tests, visual form, YAML CodeMirror, results). Bi-directional YAML↔visual sync, quick-run with SSE, validation, hooks editors, retry policy, matrix, OpenAPI toggles.

Highlights:
- Dynamic CSS injection for the 4-column layout.
- In-memory working model normalized from suite; serialization cleanup before YAML dump.
- CodeMirror with sync to DaisyUI theme.
- Editor quick-run shows all deps; can run with “with deps” or “with previous stages”.
- Writes back to YAML on visual changes and vice versa; explicit `__ed_*` methods exposed.

Issues:
- ~1900 lines single file; many responsibilities:
  - Modal shell and column layout
  - Form rendering and event handlers
  - YAML serialization and cleanup
  - Quick-run SSE wiring and badge propagation to suites view
  - Hooks/matrix editors
- Validation/UI feedback inline; little reuse across forms.
- Multiple utility redefinitions (`debounce`, `setVisualEnabled`) exist here, too.

## js/utils.js and js/helpers.js

- `js/utils.js` carries core helpers: slugify, pct, setBar, parseEnv (KV list), theme mapping, downloads, scrollBottom, etc.
- `js/helpers.js` appears to be a legacy variant: contains simplified versions of the same helpers and a different `parseEnv` (textarea-based). Not referenced by `index.html` and should be considered for removal.

## CSS: css/app.css, layout.css, components.css, themes.css, editor.css

Findings:
- CSS tokens and theme variables are defined in both `app.css` and `themes.css`. Many identical sections present.
- Layout styles exist in multiple files (`layout.css` and `css/app.css`), with overlap on container/grid rules.
- Editor-related classes are split between `editor.css` and rules injected by `editor.js`.

Issues:
- Theme duplication makes future adjustments error-prone.
- Mixing inline styles (in HTML/JS) and CSS files frustrates overriding and theming.

## Dead/Legacy candidates

- `internal/webui/static/suites.js` (top-level) appears unused; modern code and includes reference `js/suites.js`.
- `internal/webui/static/js/helpers.js` duplicates utilities from `js/utils.js` and is not referenced by `index.html`.

Before removal: verify via grep/build and a quick manual run that they are not referenced by the server when serving static files.

## Event semantics and correctness notes

- `suiteStart` emits `stages` map; for dependsOn chains the backend collapses to `{0: total}` — the FE should render a single stage row.
- `testStart`/`test` events include `path` and must be filtered per active suite to avoid cross-updates.
- Batch totals should aggregate from `suiteEnd` only to prevent double counting.

## Accessibility/UX

- Buttons add `aria-label` in many places; expand buttons manage `aria-expanded` and `aria-controls`.
- Keyboard shortcuts exist, but there is no focus management when opening the editor modal.
- Iconography is text-based (✓ ✗ -), which is screen-reader friendly; consider adding visually-hidden labels.

## Summary of primary refactor targets

1) Eliminate duplicate files: remove legacy `static/suites.js` and `js/helpers.js` after confirming no references.
2) Extract inline `<style>` from `index.html` to `css/app.css` (and dedupe with `layout.css`).
3) Componentize large monoliths:
   - Suites list + SSE listener into modules/services.
   - Editor modal split: state, form sections, yaml sync, run/validate, hooks/matrix widgets.
4) Centralize utilities in one `utils.ts` and remove per-file re-definitions.
5) Unify theme tokens in a single CSS module; keep DaisyUI mapping for third-party theme.
6) Reduce global variables; move to small state modules with explicit contracts.
