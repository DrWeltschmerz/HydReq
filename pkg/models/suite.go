package models

// Suite represents a YAML-defined test suite.
// This is a first pass; fields may evolve as features are added.

type Suite struct {
	Name      string            `yaml:"name"`
	BaseURL   string            `yaml:"baseUrl"`
	Variables map[string]string `yaml:"vars"`
	Auth      *Auth             `yaml:"auth"`
	PreSuite  []Hook            `yaml:"preSuite"`
	PostSuite []Hook            `yaml:"postSuite"`
	OpenAPI   *OpenAPIConfig    `yaml:"openApi"`
	Tests     []TestCase        `yaml:"tests"`
}

type TestCase struct {
	Name      string              `yaml:"name"`
	Request   Request             `yaml:"request"`
	Assert    Assertions          `yaml:"assert"`
	Extract   map[string]Extract  `yaml:"extract"`
	Skip      bool                `yaml:"skip"`
	Only      bool                `yaml:"only"`
	TimeoutMs int                 `yaml:"timeoutMs"`
	Repeat    int                 `yaml:"repeat"`
	Tags      []string            `yaml:"tags"`
	Retry     *Retry              `yaml:"retry"`
	Stage     int                 `yaml:"stage"`  // tests with same stage can run in parallel
	Matrix    map[string][]string `yaml:"matrix"` // data-driven: expands vars
	Vars      map[string]string   `yaml:"vars"`   // per-test variable overrides
	DependsOn []string            `yaml:"dependsOn"`
	Pre       []Hook              `yaml:"pre"`
	Post      []Hook              `yaml:"post"`
	OpenAPI   *OpenAPITest        `yaml:"openApi"`
}

type Request struct {
	Method  string            `yaml:"method"`
	URL     string            `yaml:"url"`
	Headers map[string]string `yaml:"headers"`
	Query   map[string]string `yaml:"query"`
	Body    any               `yaml:"body"`
}

type Assertions struct {
	Status        int               `yaml:"status"`
	HeaderEquals  map[string]string `yaml:"headerEquals"`
	JSONEquals    map[string]any    `yaml:"jsonEquals"`   // JSONPath -> expected
	JSONContains  map[string]any    `yaml:"jsonContains"` // JSONPath -> expected substring or value
	BodyContains  []string          `yaml:"bodyContains"`
	MaxDurationMs int64             `yaml:"maxDurationMs"`
}

type Extract struct {
	JSONPath string `yaml:"jsonPath"`
}

type Retry struct {
	Max       int `yaml:"max"`
	BackoffMs int `yaml:"backoffMs"`
	JitterPct int `yaml:"jitterPct"`
}

type Auth struct {
	BearerEnv string `yaml:"bearerEnv"`
	BasicEnv  string `yaml:"basicEnv"` // user:pass from env
}

// Hook is a lightweight action that can modify variables and/or perform HTTP checks
type Hook struct {
	Name    string             `yaml:"name"`
	Vars    map[string]string  `yaml:"vars"`
	Request *Request           `yaml:"request"`
	Assert  Assertions         `yaml:"assert"`
	Extract map[string]Extract `yaml:"extract"`
	SQL     *SQLHook           `yaml:"sql"`
}

type SQLHook struct {
	Driver  string            `yaml:"driver"` // e.g. sqlite
	DSN     string            `yaml:"dsn"`    // e.g. file:./qa.sqlite?cache=shared
	Query   string            `yaml:"query"`
	Extract map[string]string `yaml:"extract"` // varName -> columnName
}

type OpenAPIConfig struct {
	File    string `yaml:"file"`    // path to spec file
	Enabled bool   `yaml:"enabled"` // default true when file present
}

type OpenAPITest struct {
	Enabled *bool `yaml:"enabled"` // override per-test
}
