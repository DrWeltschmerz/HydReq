# OpenAPI validation

Enable response validation against an OpenAPI 3.x spec.

- Only JSON responses are validated (by Content-Type).
- Paths matched using kin-openapi router against the request path.
- Enable per test (`openApi.enabled: true`) or per suite.

See:
- `testdata/openapi.yaml`
- `testdata/specs/openapi.yaml`
