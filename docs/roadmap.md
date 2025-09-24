# Roadmap

Top Priority
- Enhanced adapters + new adapters: full-featured importers for Postman, Insomnia, HAR, OpenAPI, REST Client (VS Code), Swagger UI exports, Newman (Postman CLI) collections, Bruno with auth, variables, scripts, and advanced body types

Near-term
- Reports in GUI (download JSON/JUnit artifacts)
- Tags filter and default-timeout in GUI header (basic inputs added; refine UX and persistence)
- Editor polish: collapse persistence, Convert… cleanup, DSN helpers per driver docs, "Run with deps" badges
- YAML-preserving save path (optional raw mode with comments/order retained)
- OAuth2 client credentials helper for suite auth

Medium-term
- Results history in GUI and diffs between runs
- VS Code extension for inline runs and decorations
- OpenAPI hints expansion and response schema diffs
- Advanced reporting: interactive dashboards, trend analysis, performance metrics visualization
- AI-assisted test generation: auto-generate tests from OpenAPI specs, suggest assertions based on responses (enhances existing Copilot integration)
- Integrations: with monitoring tools (e.g., Prometheus), issue trackers (Jira, GitHub Issues)

Longer-term
- gRPC testing (reflect/proto) and contract checks
- Official Docker image and GitHub Action for CI
- Performance testing: load testing, stress testing within suites
- GraphQL support: query/mutation testing with schema validation
- Security testing: basic vulnerability scans (e.g., injection, auth bypass)
- Collaboration features: team sharing, version control for test suites
- Mobile API testing: support for mobile-specific endpoints and protocols
- Message queue testing: AMQP, MQTT, WebSockets for event-driven systems
