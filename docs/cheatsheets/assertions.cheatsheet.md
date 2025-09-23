# HydReq assertions cheatsheet

Common assertions against HTTP responses.

- status: <int>
  - Example: `status: 200`

- headerEquals: { Header-Name: "value" }
  - Example: `headerEquals: { Content-Type: application/json }`

- jsonEquals: { path: expected }
  - Exact match at a JSON path. Strings/numbers are compared after stringification when needed.
  - Example: `jsonEquals: { json.id: "42", args.q: foo }`

- jsonContains: { path: expectedSubstrOrValue }
  - Substring or value containment at a JSON path.
  - Example: `jsonContains: { json.user: qa, headers.Authorization: "Bearer" }`

- bodyContains: [ substrings ]
  - Body must include all listed substrings.
  - Example: `bodyContains: ["hello", "world"]`

- maxDurationMs: <int>
  - Response must finish within this time.
  - Example: `maxDurationMs: 500`

Tips
- Use `extract` first, then reuse variables in later assertions: `${token}`
- Combine with `retry` for eventually-consistent systems: `{ max: 5, backoffMs: 200, jitterPct: 30 }`
- For arrays, prefer jsonContains on a specific path like `items[0].id`.
