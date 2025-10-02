# Copilot Instructions for HydReq

## Project Overview

HydReq is a Go-based API testing framework that allows users to define test suites in YAML and run them against HTTP APIs. It supports importing from various formats like Postman, OpenAPI/Swagger, Bruno, Insomnia, HAR files, and REST Client format.

### Current Version
- Beta status (v0.3.x series)
- Active development with focus on Web UI refinement and usability
- CLI entrypoint: `hydreq` (deprecated: `qa`)

### Key Features
- YAML-based test definition with JSON Schema validation
- Visual editor with two-way YAML ↔ Visual sync
- Multiple import formats (7 adapters)
- Real-time execution streaming via SSE
- Comprehensive reporting (JSON, JUnit, HTML)
- JavaScript hooks for complex logic
- Environment variables and data generators
- Matrix test expansion
- Dependency-based test scheduling
- SQL database testing support (Postgres, SQL Server, SQLite)

## Key Components

### Core Structure
- `cmd/`: CLI commands (`hydreq` and `validate`)
- `internal/`: Internal packages
  - `adapters/`: Import adapters for different formats (Postman, Bruno, HAR, OpenAPI, etc.)
  - `runner/`: Test execution engine (scheduling, assertions, hooks, OpenAPI integration)
  - `report/`: Report generation (JSON, JUnit, HTML)
  - `validate/`: YAML validation against JSON schema
  - `ui/`: Terminal UI components (colors, formatting)
  - `webui/`: Web UI server (SSE streaming, editor endpoints, static assets)
  - `httpclient/`: HTTP client wrapper
  - `script/`: JavaScript execution engine for hooks
- `pkg/models/`: Core data structures (Suite, TestCase, Request, Assert, etc.)
- `pkg/assert/`: Assertion logic
- `testdata/`: Example test files and fixtures
- `schemas/`: JSON Schema for suite validation
- `scripts/`: Helper scripts for CI, reporting, and batch runs
- `.copilot/`: Copilot prompts and authoring guides

### Import Adapters
Located in `internal/adapters/`, each adapter converts external formats to HydReq's internal Suite model:
- `postman/`: Postman collections
- `newman/`: Newman (Postman CLI) format
- `bruno/`: Bruno collections
- `insomnia/`: Insomnia collections
- `har/`: HAR (HTTP Archive) files
- `oapi/`: OpenAPI/Swagger specifications
- `restclient/`: VS Code REST Client format

## Coding Conventions

### Go Standards
- Follow standard Go naming conventions
- Use `gofmt` and `goimports` for formatting
- Write comprehensive unit tests for all new code
- Use table-driven tests for multiple test cases
- Handle errors appropriately (don't ignore them)

### Project-Specific Patterns

#### Test Structure
```go
func TestAdapter_Convert(t *testing.T) {
    // Table-driven tests preferred
    tests := []struct {
        name     string
        input    string
        want     *models.Suite
        wantErr  bool
    }{
        // test cases...
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            reader := strings.NewReader(tt.input)
            got, err := Convert(reader)
            if (err != nil) != tt.wantErr {
                t.Errorf("Convert() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            // assertions...
        })
    }
}
```

#### Adapter Implementation
- Each adapter implements a `Convert` function that takes an `io.Reader` and returns `(*models.Suite, error)`
  - Some adapters (Postman, Newman) also accept `envVars map[string]string` as a second parameter
  - Example signatures:
    - `func Convert(r io.Reader) (*models.Suite, error)` (Bruno, HAR, Insomnia, OpenAPI, REST Client)
    - `func Convert(r io.Reader, envVars map[string]string) (*models.Suite, error)` (Postman, Newman)
- Parse input format and convert to `models.Suite` structure
- Handle environment variables, authentication, and scripts where applicable
- Return meaningful error messages for invalid input

#### Error Handling
- Use descriptive error messages
- Validate input before processing
- Handle edge cases (empty files, malformed data, missing fields)

## Testing Guidelines

### Unit Tests
- Test all public functions
- Cover happy path and error cases
- Use test fixtures from `testdata/` and `source-imports/` directories
- Mock external dependencies when needed
- Prefer table-driven tests for multiple test cases (see `cmd/hydreq/main_test.go`)
- Individual test functions are also acceptable for distinct scenarios (see adapter tests)

### Integration Tests
- Test end-to-end functionality
- Verify CLI commands work correctly
- Test import/export workflows

### Test Coverage
- Aim for high test coverage (>80%)
- Test edge cases and error conditions
- Use `go test -race` to check for race conditions

## Documentation

### Code Comments
- Document public functions with clear descriptions
- Explain complex logic or algorithms
- Reference external specifications when implementing standards

### Commit Messages
- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Reference issue numbers when applicable

## Development Workflow

### Adding New Features
1. Create/update issue in GitHub
2. Write tests first (TDD approach)
3. Implement functionality
4. Update documentation
5. Run full test suite (`scripts/local-ci.sh`)
6. Test in Web UI if applicable

### Import Adapter Development
1. Study the target format specification
2. Create test fixtures in `testdata/` or `source-imports/`
3. Implement `Convert` function with appropriate signature
4. Handle all supported features (auth, environments, scripts)
5. Add comprehensive tests (both unit and integration)
6. Update CLI command in `cmd/hydreq/` if needed
7. Update documentation

### CI/CD Pipeline
- **lint** job: Runs `gofmt`, `go vet`, `go mod tidy` checks
- **test** job: Runs `go test -race ./...` with coverage
- **validate** job: Validates example suites against JSON schema
- **examples** job: Runs all example suites and uploads reports
- **release** job: Triggered by version tags, builds cross-platform binaries
  - Uses GoReleaser for multi-platform builds
  - Extracts changelog section for release notes
  - Archives include binaries, schemas, scripts, and examples

### Local Development
- Run unit tests: `go test ./...`
- Run with race detector: `go test -race ./...`
- Full local CI: `./scripts/local-ci.sh`
- Start Web UI: `./bin/hydreq` (no arguments)
- Run specific suite: `./bin/hydreq run -f testdata/example.yaml`
- Validate suite: `./bin/validate testdata/example.yaml`

## Key Models

### Suite
```go
type Suite struct {
    Name      string            `yaml:"name,omitempty"`
    BaseURL   string            `yaml:"baseUrl,omitempty"`
    Variables map[string]string `yaml:"vars,omitempty"`
    Auth      *Auth             `yaml:"auth,omitempty"`
    Tests     []TestCase        `yaml:"tests,omitempty"`
    PreSuite  []Hook            `yaml:"preSuite,omitempty"`
    PostSuite []Hook            `yaml:"postSuite,omitempty"`
    OpenAPI   *OpenAPIConfig    `yaml:"openApi,omitempty"`
    // ... other fields
}
```

### TestCase
```go
type TestCase struct {
    Name      string            `yaml:"name"`
    Request   Request           `yaml:"request"`
    Assert    Assertions        `yaml:"assert,omitempty"`
    Extract   map[string]Extract `yaml:"extract,omitempty"`
    Pre       []Hook            `yaml:"pre,omitempty"`
    Post      []Hook            `yaml:"post,omitempty"`
    Tags      []string          `yaml:"tags,omitempty"`
    Stage     int               `yaml:"stage,omitempty"`
    DependsOn []string          `yaml:"dependsOn,omitempty"`
    Matrix    map[string][]any  `yaml:"matrix,omitempty"`
    // ... other fields
}
```

### Report Formats
- **JSON**: Detailed structured output with timing, assertions, and errors
- **JUnit XML**: Compatible with CI/CD systems (Jenkins, GitHub Actions, etc.)
- **HTML**: Interactive reports with donut charts, filters, and theme toggle
  - Per-suite reports: Individual suite results with test details
  - Batch reports: Aggregated multi-suite run with expandable sections

## Common Patterns

### YAML Suite Authoring
- Suite schema: `schemas/suite.schema.json` provides validation and completions
- Copilot prompts: `.copilot/prompts/suite.prompts.md` guides AI-assisted authoring
- Variables: `${var}`, `${ENV:VAR}`, `${FAKE:uuid}`, `${EMAIL}`, `${NOW[:offset]:layout}`, `${RANDINT:min:max}`
- Assertions: `status`, `jsonEquals`, `jsonContains`, `bodyContains`, `maxDurationMs`
- Hooks: `pre`/`post` per test, `preSuite`/`postSuite` at suite level
  - Hook types: HTTP request, SQL query, JavaScript code
- Scheduling: Use `stage` for ordering, `dependsOn` for explicit dependencies
- Matrix expansion: Generate multiple tests from parameter combinations
- Tags: Filter tests with `tags: [smoke, regression]` and `--tags` CLI flag

### YAML Parsing
- Use `gopkg.in/yaml.v3` for YAML processing
- Handle both YAML and JSON input where applicable
- Validate required fields

### HTTP Client Usage
- Use standard `net/http` package
- Set appropriate timeouts and headers
- Handle different content types (JSON, XML, form data)

### File Operations
- Use `io.Reader` interfaces for input
- Handle both files and in-memory data
- Close files properly with `defer`

## Performance Considerations

- Avoid unnecessary allocations
- Use buffered I/O for large files
- Cache parsed data when appropriate
- Profile performance-critical code

## Security

- Validate all input data
- Avoid command injection vulnerabilities
- Handle sensitive data (API keys, passwords) appropriately
- Use secure defaults for timeouts and limits

## Web UI Development

### Architecture
- Server: `internal/webui/webui.go` - Go HTTP server with SSE streaming
- Static assets: `internal/webui/static/` - HTML, CSS, JavaScript for the editor
- Two-way sync: YAML ↔ Visual editor with live validation
- SSE protocol: Real-time test execution updates

### Key Endpoints
- `/api/editor/suites` - List available suites
- `/api/editor/suite` - Load/save suite files
- `/api/editor/validate` - Validate suite against JSON schema
- `/api/editor/run-test` - Execute single test with dependency resolution
- `/stream/batch` - SSE stream for batch run updates

### Editor Features
- Visual editor mode with form-based test editing
- YAML editor with schema validation
- Quick run (single test or with dependencies)
- Batch run with environment overrides and tag filtering
- Theme toggle (light/dark) with persistence

## Helper Scripts

### CI and Testing
- `scripts/local-ci.sh` - Run full test suite locally (unit tests + integration tests)
- `scripts/run-examples.sh` - Execute all example suites and generate reports
- `scripts/run-suites.sh` - Batch runner with JSON/JUnit/HTML output

### Reporting
- `scripts/pr-summary.sh` - Generate PR-ready Markdown summary from JSON reports
- `scripts/post-pr-summary.sh` - Post summary as PR comment using `gh` CLI
- `scripts/suggest-assertions.sh` - Generate assertion suggestions from test results
- `scripts/compare-reports.sh` - Diff two JSON reports

### Environment
- Scripts automatically set `HTTPBIN_BASE_URL` for local development
- Use `KEEP_SERVICES=1` to keep Docker containers running after tests
- Use `SKIP_VALIDATION=1` or `VALIDATION_WARN_ONLY=1` for validation control