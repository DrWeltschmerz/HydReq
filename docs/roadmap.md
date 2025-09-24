# Roadmap

## Top Priority

The following tasks are top priority for import adapter and migration features. See linked issues for details:

### Issue links in implementation order

1. ✅ [#11 Upgrade Existing Import Adapters](https://github.com/DrWeltschmerz/HydReq/issues/11) - **COMPLETED**
2. ✅ [#12 Develop New Import Adapters](https://github.com/DrWeltschmerz/HydReq/issues/12) - **COMPLETED**
3. ✅ [#13 Implement JavaScript Scripting/Translation](https://github.com/DrWeltschmerz/HydReq/issues/13) - **COMPLETED**
4. ✅ [#14 Add Environment/Variable Mapping](https://github.com/DrWeltschmerz/HydReq/issues/14) - **COMPLETED**
5. ✅ [#15 Improve CLI Import Commands](https://github.com/DrWeltschmerz/HydReq/issues/15) - **COMPLETED**
6. ✅ [#16 Ensure Comprehensive Test Coverage](https://github.com/DrWeltschmerz/HydReq/issues/16) - **COMPLETED**

---

### Task Dependencies, Order, and Ease

**1. Upgrade Existing Import Adapters for Full Feature Coverage (#11)**  
Depends on: None (core/foundational work).  
Order: First. Sets baseline for other improvements.  
Difficulty: Medium-Hard (covers multiple features).  
Notes: Must support auth, environments, scripts, advanced bodies, folders.

**2. Develop New Import Adapters for Additional Formats (#12)**  
Depends on: #11 for guidance on "full feature coverage" standards.  
Order: Second. After upgrading existing adapters, implement new ones similarly.  
Difficulty: Medium (varies by format complexity).  
Notes: Must research and map new formats (REST Client, Swagger UI, Newman).

**3. Implement JavaScript Scripting Support and Script Translation for Import Adapters (#13)**  
Depends on: #11, for script migration within adapters; can partly run in parallel.  
Order: Third. Needed for script migration and translation in imports.  
Difficulty: Hard (JS sandbox, translation logic).  
Notes: Enables script hooks in HydReq and adapter migration.

**4. Add Environment and Variable Mapping to Import Adapters (#14)**  
Depends on: #11, #12, #13 (adapters must parse environments for mapping).  
Order: Fourth. Complements scripting and core adapter work.  
Difficulty: Medium.  
Notes: Variable scoping and CLI customization.

**5. Improve CLI Import Commands with Customization Options (#15)**  
Depends on: #11, #12, #13, #14 (CLI exposes options for all the above features).  
Order: Fifth. Surfaces all new features to users.  
Difficulty: Easy-Medium (if CLI infra is solid).  
Notes: Flags for scripts, envs, folders, etc.

**6. Ensure Comprehensive Test Coverage for Import Adapters (#16)**  
Depends on: All previous tasks (must test all new/adapted features).  
Order: Last. Should cover all code paths and edge cases added above.  
Difficulty: Medium (tedious but straightforward).

---

### Easiest & Fastest Task

- **Easiest/Fastest:** [#15 Improve CLI Import Commands](https://github.com/DrWeltschmerz/HydReq/issues/15) (if CLI is well-structured).
- **Next Easiest:** [#14 Add Environment and Variable Mapping](https://github.com/DrWeltschmerz/HydReq/issues/14) (if adapters parse environments cleanly).

---

### Dependencies/Tree

```
#11 → #12 → #13 → #14 → #15 → #16

Or, as some work can overlap:

#11 (upgrade existing adapters)
   ├─ #13 (JS scripting support/translation)
   ├─ #12 (new adapters, adopting #11's standards)
        └─ #14 (env/variable mapping, after adapters parse environments)
             └─ #15 (CLI exposes all above)
                  └─ #16 (tests everything)
```

---

# Near-term
- Reports in GUI (download JSON/JUnit artifacts)
- Tags filter and default-timeout in GUI header (basic inputs added; refine UX and persistence)
- Editor polish: collapse persistence, Convert… cleanup, DSN helpers per driver docs, "Run with deps" badges
- YAML-preserving save path (optional raw mode with comments/order retained)
- OAuth2 client credentials helper for suite auth

# Medium-term
- Results history in GUI and diffs between runs
- VS Code extension for inline runs and decorations
- OpenAPI hints expansion and response schema diffs
- Advanced reporting: interactive dashboards, trend analysis, performance metrics visualization
- AI-assisted test generation: auto-generate tests from OpenAPI specs, suggest assertions based on responses (enhances existing Copilot integration)
- Integrations: with monitoring tools (e.g., Prometheus), issue trackers (Jira, GitHub Issues)

# Longer-term
- gRPC testing (reflect/proto) and contract checks
- Official Docker image and GitHub Action for CI
- Performance testing: load testing, stress testing within suites
- GraphQL support: query/mutation testing with schema validation
- Security testing: basic vulnerability scans (e.g., injection, auth bypass)
- Collaboration features: team sharing, version control for test suites
- Mobile API testing: support for mobile-specific endpoints and protocols
- Message queue testing: AMQP, MQTT, WebSockets for event-driven systems
