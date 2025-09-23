# HydReq suite cheatsheet

Minimal reference for authoring YAML suites.

Top-level keys
- name: string
- baseUrl: string (can use ${ENV:VAR})
- vars: { KEY: "value" }
- auth: { bearerEnv: ENV_NAME, basicEnv: ENV_NAME }
- openApi: { file: path, enabled: true|false }
- preSuite/postSuite: [hooks]
- tests: [testCase]

Test case shape
- name: string (unique)
- request: { method, url, headers?, query?, body? }
- assert: { status?, headerEquals?, jsonEquals?, jsonContains?, bodyContains?, maxDurationMs? }
- extract?: { varName: { jsonPath } }
- skip?|only?: bool
- timeoutMs?: int
- repeat?: int
- tags?: [string]
- retry?: { max, backoffMs, jitterPct }
- stage?: int
- matrix?: { key: [values] }
- vars?: { KEY: "value" }
- dependsOn?: [testName]
- pre?/post?: [hooks]
- openApi?: { enabled: bool }

Interpolation
- ${var} from suite/test vars
- ${ENV:VAR} from environment
- Generators: ${FAKE:uuid}, ${EMAIL}, ${NOW[:offset]:layout}, ${RANDINT:min:max}

Hooks
- HTTP: request + assert + optional extract
- SQL: { driver, dsn, query, extract: { var: column } }

Scheduling
- stage: same stage runs in parallel, higher stages later
- dependsOn: DAG ordering by test names

Matrix
- Expand variants from key: [values]; use ${key} in request/assert

OpenAPI
- Suite-level: openApi: { file, enabled }
- Per-test override: openApi.enabled

Examples
```yaml
name: httpbin smoke
baseUrl: ${ENV:HTTPBIN_BASE_URL}
vars:
  HTTPBIN_BASE_URL: https://httpbin.org

tests:
  - name: get headers
    request: { method: GET, url: /headers }
    assert:
      status: 200
      jsonContains:
        headers.Host: httpbin.org

  - name: extract id
    request: { method: POST, url: /anything, body: { id: 42 } }
    assert: { status: 200, jsonEquals: { json.id: "42" } }
    extract:
      myId: { jsonPath: json.id }

  - name: matrix colors
    request:
      method: GET
      url: /anything
      query: { color: "${color}" }
    assert: { status: 200, jsonEquals: { args.color: "${color}" } }
    matrix:
      color: [red, blue]
```
