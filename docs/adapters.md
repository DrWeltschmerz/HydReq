# Adapters (import)

Convert external formats into HydReq suites:

- Postman (v2.1 JSON)
- Insomnia (export JSON)
- HAR (HTTP Archive)
- OpenAPI (3.x)
- Bruno (minimal export)

CLI examples:
```
hydreq import postman path/to/collection.json > suite.yaml
hydreq import insomnia path/to/export.json > suite.yaml
hydreq import har path/to/archive.har > suite.yaml
hydreq import openapi path/to/spec.(yaml|json) > suite.yaml
hydreq import bruno path/to/export.json > suite.yaml
```

Notes:
- Postman/Insomnia: subset mapping (method/url/headers/body). Add/adjust assertions.
- HAR: default assert status=200.
- OpenAPI: skeleton per operation; picks 200 if present, else first numeric code.
- Bruno: flattened export into basic requests.
