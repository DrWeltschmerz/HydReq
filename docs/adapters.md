# Adapters (import)

> Quick start for imports is covered in the consolidated [USER_GUIDE](./USER_GUIDE.md). This page provides format‑specific flags and examples.

Convert external formats into HydReq suites:

- Postman (v2.1 JSON)
- Newman (Postman CLI format)
- Insomnia (export JSON)
- Bruno (minimal export)
- HAR (HTTP Archive)
- OpenAPI/Swagger (3.x, 2.0)
- REST Client (VS Code .http files)

CLI examples:
```
hydreq import postman path/to/collection.json > suite.hrq.yaml
hydreq import postman path/to/collection.json --env path/to/environment.json > suite.hrq.yaml
hydreq import postman path/to/collection.json --base-url https://staging.api.com --verbose > suite.hrq.yaml
hydreq import newman path/to/collection.json > suite.hrq.yaml
hydreq import newman path/to/collection.json --env path/to/environment.json --skip-auth > suite.hrq.yaml
hydreq import insomnia path/to/export.json > suite.hrq.yaml
hydreq import insomnia path/to/export.json --flat --no-scripts > suite.hrq.yaml
hydreq import har path/to/archive.har > suite.hrq.yaml
hydreq import har path/to/archive.har --base-url https://api.example.com > suite.hrq.yaml
hydreq import openapi path/to/spec.(yaml|json) > suite.hrq.yaml
hydreq import openapi path/to/spec.(yaml|json) --base-url https://api.example.com > suite.hrq.yaml
hydreq import bruno path/to/export.json > suite.hrq.yaml
hydreq import bruno path/to/export.json --flat > suite.hrq.yaml
hydreq import restclient path/to/requests.http > suite.hrq.yaml
hydreq import restclient path/to/requests.http --base-url https://api.example.com > suite.hrq.yaml
```

### Import Flags

- `--env <file>`: Load environment variables from JSON file (Postman/Newman only)
- `--base-url <url>`: Override base URL for all requests
- `--verbose`: Show detailed import information
- `--no-scripts`: Skip conversion of pre/post request scripts (Postman/Insomnia/Bruno/Newman)
- `--flat`: Flatten folder structure into simple test names (Postman/Insomnia/Bruno/Newman)
- `--skip-auth`: Skip conversion of authentication settings (Postman/Insomnia/Bruno/Newman)
- `--out <file>`: Write output to file instead of stdout

Environment Variables:
- Postman/Newman: Use `--env` flag to specify a Postman environment JSON file. Environment variables override collection variables.
- Insomnia: Environment variables are automatically extracted from export files.
- Bruno: Environment variables are automatically extracted from collection exports (only enabled variables).
- OpenAPI/HAR/REST Client: Do not support environment variables.

Notes:
- Postman/Newman/Insomnia/Bruno: Full feature mapping including authentication, scripts/hooks, environment variables, and advanced request bodies.
- HAR: HTTP Archive format with request/response capture and replay; default assert status=200.
- OpenAPI/Swagger: Security schemes (bearer, basic auth), parameter extraction, response validation.
- REST Client: Query parameter parsing, multiple headers, request body handling.
