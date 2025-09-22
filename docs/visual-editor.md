# Visual YAML Editor (beta)

The Web UI includes a visual editor for suite YAMLs. It aims to keep authoring fast and safe while preserving a minimal YAML style on save.

What you can do
- Browse tests and add/delete tests.
- Edit Request: method, URL path, timeout, headers, query, body (JSON or text).
- Define Assertions: status, headers, JSON equals/contains, body contains, max duration.
- Extract variables (JSONPath via gjson syntax, e.g. `json.id`, `data.items.0.id`).
- Flow & Meta: skip/only, stage, tags, dependsOn, timeout.
- Retry: max/backoff/jitter.
- Matrix: simple var -> [values] lists.
- OpenAPI: per-test override to inherit/enable/disable.
- Hooks (HTTP/SQL):
	- Add hook rows via a template selector (Empty/HTTP/SQL). The mode is locked per row and only relevant fields are shown.
	- HTTP: method, URL, headers, query, body.
	- SQL: driver (sqlite/pgx/sqlserver), DSN with show/hide, one-click DSN templates, query, extract column->var mapping.
	- Collapse/expand each row, and see a type badge (HTTP/SQL).
	- Convert… action to switch modes (optional).
	- Run a single hook inline to see pass/fail, messages, and extracted vars.

YAML tab and mirroring
- The YAML tab shows a read-only live mirror of the Visual state (serialized on the server). Toggle tabs any time.
- You can still Save from the YAML tab to preserve your manual formatting/comments; otherwise Visual saves re-serialize to a minimal format.

Quick Run and validation
- Quick Run executes the currently selected test (or the whole suite when on the YAML tab). You can toggle “with deps” to include transitive dependsOn.
- Validation shows issues with severity and path; one-click Copy collects them plus the YAML preview.

Quality-of-life
- Save vs Save & Close. Saves are atomic and create timestamped backups.
- Dark theme by default; density toggle (compact/comfortable); resizable preview pane; sticky headers.
- Per-test quick-run cache and badges.

Notes
- Edits are restricted to `testdata/`.
- The YAML output from Visual save uses `omitempty` across models to avoid emitting empty values. Strings that might be misread (e.g., `yes`, `on`, numeric-looking) will be quoted for correctness.
- More validations (engine-level and OpenAPI checks) will continue to improve.
