# HydReq Suite authoring guide (for Copilot)

You are helping write YAML API test suites for the `hydreq` tool.

Keep these rules in mind:

- Top-level keys: `name`, `baseUrl`, `vars`, `auth`, `openApi`, `preSuite`, `postSuite`, `tests`.
- Use env-configurable base URL: `baseUrl: ${ENV:HTTPBIN_BASE_URL}` and include a fallback in `vars` like `HTTPBIN_BASE_URL: https://httpbin.org`.
- Each test has: `name`, `request`, `assert`, optional `extract`, `skip|only`, `timeoutMs`, `repeat`, `tags`, `retry`, `stage`, `matrix`, `vars`, `dependsOn`, `pre`, `post`, `openApi`.
- Request: `method`, `url` (path, not full URL—runner joins with baseUrl), optional `headers`, `query`, `body` (object/string/array).
- Assertions include any of:
  - `status: <int>`
  - `headerEquals: { Header-Name: "value" }`
  - `jsonEquals: { json.path: "expected" }`
  - `jsonContains: { json.path: "substr or value" }`
  - `bodyContains: ["substr"]`
  - `maxDurationMs: <int>`
- Extraction: `extract: { varName: { jsonPath: path } }` and reuse with `${varName}`.
- Interpolation supports `${var}`, `${ENV:VAR}`, and generators `${FAKE:uuid}`, `${EMAIL}`, `${NOW[:offset]:layout}`, `${RANDINT:min:max}`.
- Hooks: add `pre`/`post` arrays to tests or `preSuite`/`postSuite` at top-level. Hooks can set `vars`, run HTTP `request` with `assert` and `extract`, or run `sql` with `driver|dsn|query|extract`.
- Scheduling:
  - Use `stage` for simple ordering; same-stage tests run in parallel.
  - Or use `dependsOn` for a DAG; duplicate names are not allowed with `dependsOn`.
- Matrix expansion: add `matrix:` with key: [values] to generate cartesian combinations; use vars in body/query/headers.
- OpenAPI validation: enable suite-level `openApi: { file: path, enabled: true }` and optionally per-test `openApi.enabled`.

Tip: While authoring, you can run tests from the CLI (`hydreq run -f suite.yaml`) or use the built-in Web UI by running `hydreq` with no arguments to launch a local GUI.

Examples:

```yaml
name: httpbin smoke
baseUrl: ${ENV:HTTPBIN_BASE_URL}
vars:
  HTTPBIN_BASE_URL: https://httpbin.org
  token: demo123

tests:
  - name: echo headers
    request: { method: GET, url: /headers, headers: { Authorization: "Bearer ${token}" } }
    assert:
      status: 200
      jsonContains:
        headers.Authorization: "Bearer ${token}"

  - name: post body and extract
    request: { method: POST, url: /anything, body: { id: 42, user: qa } }
    assert: { status: 200, jsonEquals: { json.id: "42", json.user: qa } }
    extract:
      echoedUser: { jsonPath: json.user }

  - name: matrix demo
    request:
      method: GET
      url: /anything
      query:
        color: "${color}"
        size: "${size}"
    assert: { status: 200, jsonEquals: { args.color: "${color}", args.size: "${size}" } }
    matrix:
      color: [red, blue]
      size: [S, M]
```
