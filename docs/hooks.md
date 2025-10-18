# Hooks (HTTP, SQL, JavaScript)

Hooks let you run steps before/after the suite and around each test.

- preSuite/postSuite: global setup/teardown (set vars, HTTP calls, assertions, extract)
- pre/post (per test): local setup/verification

## Hook Types

### HTTP Hooks

HTTP hooks let you make requests with full assertion and extraction support.

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

### SQL Hooks

SQL hooks let you run database queries with optional variable extraction. See `docs/sql-hooks.md` for details.

### JavaScript Hooks

JavaScript hooks provide the most flexibility, allowing you to execute custom logic with access to request/response objects and variables.

```yaml
tests:
  - name: JS hook example
    pre:
      - name: Generate dynamic data
        js:
          code: |
            setVar('user_id', Math.floor(Math.random() * 1000));
            setVar('timestamp', new Date().toISOString());
            console.log('Generated user ID:', getVar('user_id'));
    request:
      method: POST
      url: /users
      body:
        id: ${user_id}
        created_at: ${timestamp}
    post:
      - name: Process response
        js:
          code: |
            if (response.status === 200) {
              setVar('created_user_id', response.body.json.id);
              console.log('Created user with ID:', getVar('created_user_id'));
            } else {
              console.error('Failed to create user:', response.status);
            }
    assert:
      status: 200
```

#### JavaScript API

**Variables:**
- `setVar(name, value)` - Set a variable for use in templates and other hooks
- `getVar(name)` - Get a variable value

**Context Objects:**
- `request` - Current HTTP request object (method, url, headers, body)
- `response` - HTTP response object (status, headers, body) - *only available in post hooks*

**Standard JavaScript:**
- Full ES5+ support with standard libraries (Math, Date, JSON, etc.)
- `console.log()` for debugging output

#### Use Cases

- **Dynamic data generation**: Random IDs, timestamps, test data
- **Response processing**: Extract values, validate complex logic
- **Conditional logic**: Branch based on previous results
- **Custom assertions**: Beyond built-in assertion types
- **Integration testing**: Complex multi-step workflows

See `testdata/js-hooks.hrq.yaml` for comprehensive examples.
