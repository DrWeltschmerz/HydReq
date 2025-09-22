# Hooks (HTTP)

Hooks let you run steps before/after the suite and around each test.

- preSuite/postSuite: global setup/teardown (set vars, HTTP calls, assertions, extract)
- pre/post (per test): local setup/verification

Example:
```
preSuite:
  - name: init
    vars:
      token: demo-token

postSuite:
  - name: finalize
    vars:
      done: yes

tests:
  - name: example with hooks
    pre:
      - name: set local var
        vars:
          local: hook-value
    request: { method: GET, url: /headers }
    assert: { status: 200 }
    post:
      - name: verify via POST
        request:
          method: POST
          url: /anything
          body:
            echo: ok
        assert:
          status: 200
          jsonEquals:
            json.echo: ok
```
