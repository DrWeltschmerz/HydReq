# JavaScript Scripting Guide

HydReq supports advanced scripting through JavaScript hooks, enabling complex test automation, dynamic data generation, and custom logic execution.

## Quick Start

```yaml
tests:
  - name: Basic JS hook
    pre:
      - name: Set variables
        js:
          code: |
            setVar('timestamp', new Date().toISOString());
            setVar('random_id', Math.random().toString(36).substr(2, 9));
    request:
      method: POST
      url: /api/data
      body:
        id: ${random_id}
        created: ${timestamp}
    assert:
      status: 200
```

## JavaScript API Reference

### Variable Management

#### `setVar(name, value)`
Set a variable for use in templates and other hooks.

```javascript
// Set string variables
setVar('api_key', 'abc123');
setVar('version', 'v1.0');

// Set computed values
setVar('timestamp', new Date().toISOString());
setVar('random_id', Math.floor(Math.random() * 1000));

// Set from response data
setVar('user_count', response.body.json.total);
```

#### `getVar(name)`
Get a variable value (returns string).

```javascript
var apiKey = getVar('api_key');
var baseUrl = getVar('base_url') || 'https://api.example.com';

// Use in computations
var counter = parseInt(getVar('counter') || '0') + 1;
setVar('counter', counter.toString());
```

### Context Objects

#### `request` Object (Pre-hooks only)
Access the current HTTP request being prepared.

```javascript
// Available in pre-request hooks
console.log('Method:', request.method);        // "GET", "POST", etc.
console.log('URL:', request.url);              // "/api/users"
console.log('Headers:', request.headers);      // Object with header values
console.log('Query params:', request.query);   // Object with query values
console.log('Body:', request.body);            // Request body (string/object)
```

#### `response` Object (Post-hooks only)
Access the HTTP response received.

```javascript
// Available in post-response hooks
console.log('Status:', response.status);       // 200, 404, etc.
console.log('Headers:', response.headers);     // Response headers object
console.log('Body:', response.body);           // Raw response body

// Parse JSON response
if (response.body && typeof response.body === 'object') {
    console.log('JSON response:', response.body.json);
    setVar('user_id', response.body.json.id);
}
```

## Advanced Examples

### Dynamic Data Generation

```javascript
// Generate realistic test data
setVar('email', 'user' + Math.floor(Math.random() * 1000) + '@example.com');
setVar('phone', '+1-' + Math.floor(Math.random() * 900 + 100) + '-' + Math.floor(Math.random() * 9000 + 1000));

// Generate timestamps
setVar('future_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
setVar('past_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
```

### Conditional Logic

```javascript
// Environment-based configuration
var env = getVar('environment') || 'dev';
if (env === 'prod') {
    setVar('api_url', 'https://api.production.com');
    setVar('timeout', '5000');
} else {
    setVar('api_url', 'https://api.dev.com');
    setVar('timeout', '10000');
}

// Response-based decisions
if (response.status === 429) {
    setVar('retry_after', response.headers['retry-after'] || '60');
    console.log('Rate limited, retrying after', getVar('retry_after'), 'seconds');
}
```

### Array and Object Manipulation

```javascript
// Work with arrays
var testUsers = ['alice', 'bob', 'charlie'];
var randomUser = testUsers[Math.floor(Math.random() * testUsers.length)];
setVar('test_user', randomUser);

// Parse and manipulate JSON
var config = JSON.parse(getVar('config_json') || '{}');
config.last_run = new Date().toISOString();
setVar('updated_config', JSON.stringify(config));

// Generate test data arrays
var testData = [];
for (var i = 0; i < 5; i++) {
    testData.push({
        id: i + 1,
        name: 'Test Item ' + (i + 1),
        value: Math.random() * 100
    });
}
setVar('test_items', JSON.stringify(testData));
```

### Error Handling

```javascript
try {
    var data = JSON.parse(getVar('json_data'));
    if (!data.id) {
        throw new Error('Missing required field: id');
    }
    setVar('processed_id', data.id.toString());
} catch (e) {
    console.error('Data processing error:', e.message);
    setVar('error_message', e.message);
    setVar('processing_failed', 'true');
}
```

### Integration Testing Workflows

```javascript
// Multi-step workflow
setVar('step', '1');

// In pre-hook: prepare data
var workflowData = {
    session_id: 'session_' + Date.now(),
    steps: []
};
setVar('workflow', JSON.stringify(workflowData));

// In post-hook: record results
var workflow = JSON.parse(getVar('workflow'));
workflow.steps.push({
    step: getVar('step'),
    status: response.status,
    timestamp: new Date().toISOString()
});
setVar('workflow', JSON.stringify(workflow));

// Increment step counter
var nextStep = (parseInt(getVar('step')) + 1).toString();
setVar('step', nextStep);
```

## Best Practices

### Performance
- Keep scripts lightweight - they're executed synchronously
- Avoid infinite loops or very long computations
- Use `console.log()` sparingly in production tests

### Error Handling
- Always wrap complex logic in try-catch blocks
- Set error flags for test assertions to check
- Log meaningful error messages for debugging

### Variable Naming
- Use consistent naming conventions
- Prefix related variables (e.g., `user_id`, `user_name`, `user_email`)
- Document variable purposes in comments

### Security
- Never log sensitive data (passwords, tokens, PII)
- Be careful with dynamic code execution
- Validate inputs before processing

## Migration from Other Tools

### Postman Scripts
```javascript
// Postman pre-request script
pm.environment.set('timestamp', new Date().toISOString());

// HydReq equivalent
setVar('timestamp', new Date().toISOString());
```

### Insomnia Scripts
```javascript
// Insomnia pre-request script
const timestamp = new Date().toISOString();
insomnia.environment.set('timestamp', timestamp);

// HydReq equivalent
setVar('timestamp', new Date().toISOString());
```

## Debugging

### Console Output
```javascript
console.log('Debug info:', variable);
console.error('Error occurred:', error);
console.warn('Warning:', message);
```

### Variable Inspection
```javascript
// Log all current variables
console.log('Current vars:', Object.keys(vars).map(k => `${k}=${vars[k]}`));

// Inspect request/response
console.log('Request:', JSON.stringify(request, null, 2));
console.log('Response status:', response.status);
```

## Complete Example

See `testdata/js-hooks.yaml` for a comprehensive example suite demonstrating all JS hook capabilities.

## Limitations

- No access to file system or network (except through HTTP hooks)
- No persistent state between test runs
- Execution timeout: 30 seconds for HTTP hooks, 5 seconds for JS-only hooks
- ES5+ compatible (no ES6 modules or advanced features)