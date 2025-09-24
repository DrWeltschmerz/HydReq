# Copilot Instructions for HydReq

## Project Overview

HydReq is a Go-based API testing framework that allows users to define test suites in YAML and run them against HTTP APIs. It supports importing from various formats like Postman, OpenAPI/Swagger, Bruno, Insomnia, HAR files, and REST Client format.

## Key Components

### Core Structure
- `cmd/`: CLI commands (`hydreq` and `validate`)
- `internal/`: Internal packages
  - `adapters/`: Import adapters for different formats
  - `runner/`: Test execution engine
  - `report/`: Report generation
  - `validate/`: YAML validation against JSON schema
  - `ui/`: Web UI components
- `pkg/models/`: Core data structures (Suite, TestCase, etc.)
- `pkg/assert/`: Assertion logic
- `testdata/`: Example test files and fixtures

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
- Each adapter implements a `Convert(io.Reader) (*models.Suite, error)` function
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
- Use test fixtures from `testdata/` directory
- Mock external dependencies when needed

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
5. Run full test suite

### Import Adapter Development
1. Study the target format specification
2. Create test fixtures in `testdata/`
3. Implement `Convert` function
4. Handle all supported features (auth, environments, scripts)
5. Add comprehensive tests
6. Update CLI and documentation

## Key Models

### Suite
```go
type Suite struct {
    Name      string            `yaml:"name,omitempty"`
    BaseURL   string            `yaml:"baseUrl,omitempty"`
    Variables map[string]string `yaml:"vars,omitempty"`
    Auth      *Auth             `yaml:"auth,omitempty"`
    Tests     []TestCase        `yaml:"tests,omitempty"`
    // ... other fields
}
```

### TestCase
```go
type TestCase struct {
    Name    string     `yaml:"name"`
    Request Request    `yaml:"request"`
    Assert  Assertions `yaml:"assert,omitempty"`
    // ... other fields
}
```

## Common Patterns

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