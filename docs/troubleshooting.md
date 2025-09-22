# Troubleshooting

- Requests fail or hang: check proxies/DNS and per-test `timeoutMs`.
- SQLite “no such table”: prefer a file DSN when separate hooks are used (persists connections).
- SQL DSN errors: verify `driver` matches DSN (sqlite/pgx/sqlserver) and credentials.
- OpenAPI route not found: ensure request path (without baseUrl) matches the spec and method.
