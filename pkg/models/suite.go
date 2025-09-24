package models

// Suite represents a YAML-defined test suite.
// This is a first pass; fields may evolve as features are added.

type Suite struct {
	Name      string            `yaml:"name,omitempty" json:"name"`
	BaseURL   string            `yaml:"baseUrl,omitempty" json:"baseUrl"`
	Variables map[string]string `yaml:"vars,omitempty" json:"vars"`
	Auth      *Auth             `yaml:"auth,omitempty" json:"auth"`
	PreSuite  []Hook            `yaml:"preSuite,omitempty" json:"preSuite"`
	PostSuite []Hook            `yaml:"postSuite,omitempty" json:"postSuite"`
	OpenAPI   *OpenAPIConfig    `yaml:"openApi,omitempty" json:"openApi"`
	Tests     []TestCase        `yaml:"tests,omitempty" json:"tests"`
}

type TestCase struct {
	Name      string              `yaml:"name" json:"name"`
	Request   Request             `yaml:"request" json:"request"`
	Assert    Assertions          `yaml:"assert,omitempty" json:"assert"`
	Extract   map[string]Extract  `yaml:"extract,omitempty" json:"extract"`
	Skip      bool                `yaml:"skip,omitempty" json:"skip"`
	Only      bool                `yaml:"only,omitempty" json:"only"`
	TimeoutMs int                 `yaml:"timeoutMs,omitempty" json:"timeoutMs"`
	Repeat    int                 `yaml:"repeat,omitempty" json:"repeat"`
	Tags      []string            `yaml:"tags,omitempty" json:"tags"`
	Retry     *Retry              `yaml:"retry,omitempty" json:"retry"`
	Stage     int                 `yaml:"stage,omitempty" json:"stage"`   // tests with same stage can run in parallel
	Matrix    map[string][]string `yaml:"matrix,omitempty" json:"matrix"` // data-driven: expands vars
	Vars      map[string]string   `yaml:"vars,omitempty" json:"vars"`     // per-test variable overrides
	DependsOn []string            `yaml:"dependsOn,omitempty" json:"dependsOn"`
	Pre       []Hook              `yaml:"pre,omitempty" json:"pre"`
	Post      []Hook              `yaml:"post,omitempty" json:"post"`
	OpenAPI   *OpenAPITest        `yaml:"openApi,omitempty" json:"openApi"`
}

type Request struct {
	Method  string            `yaml:"method" json:"method"`
	URL     string            `yaml:"url" json:"url"`
	Headers map[string]string `yaml:"headers,omitempty" json:"headers"`
	Query   map[string]string `yaml:"query,omitempty" json:"query"`
	Body    any               `yaml:"body,omitempty" json:"body"`
}

type Assertions struct {
	Status        int               `yaml:"status,omitempty" json:"status"`
	HeaderEquals  map[string]string `yaml:"headerEquals,omitempty" json:"headerEquals"`
	JSONEquals    map[string]any    `yaml:"jsonEquals,omitempty" json:"jsonEquals"`     // JSONPath -> expected
	JSONContains  map[string]any    `yaml:"jsonContains,omitempty" json:"jsonContains"` // JSONPath -> expected substring or value
	BodyContains  []string          `yaml:"bodyContains,omitempty" json:"bodyContains"`
	MaxDurationMs int64             `yaml:"maxDurationMs,omitempty" json:"maxDurationMs"`
}

type Extract struct {
	JSONPath string `yaml:"jsonPath,omitempty" json:"jsonPath"`
}

type Retry struct {
	Max       int `yaml:"max,omitempty" json:"max"`
	BackoffMs int `yaml:"backoffMs,omitempty" json:"backoffMs"`
	JitterPct int `yaml:"jitterPct,omitempty" json:"jitterPct"`
}

type Auth struct {
	BearerEnv string `yaml:"bearerEnv,omitempty" json:"bearerEnv"`
	BasicEnv  string `yaml:"basicEnv,omitempty" json:"basicEnv"` // user:pass from env
}

// Hook is a lightweight action that can modify variables and/or perform HTTP checks
type Hook struct {
	Name    string             `yaml:"name,omitempty" json:"name"`
	Vars    map[string]string  `yaml:"vars,omitempty" json:"vars"`
	Request *Request           `yaml:"request,omitempty" json:"request"`
	Assert  Assertions         `yaml:"assert,omitempty" json:"assert"`
	Extract map[string]Extract `yaml:"extract,omitempty" json:"extract"`
	SQL     *SQLHook           `yaml:"sql,omitempty" json:"sql"`
	JS      *JSHook            `yaml:"js,omitempty" json:"js"`
}

type SQLHook struct {
	Driver  string            `yaml:"driver,omitempty" json:"driver"` // e.g. sqlite
	DSN     string            `yaml:"dsn,omitempty" json:"dsn"`       // e.g. file:./qa.sqlite?cache=shared
	Query   string            `yaml:"query,omitempty" json:"query"`
	Extract map[string]string `yaml:"extract,omitempty" json:"extract"` // varName -> columnName
}

type OpenAPIConfig struct {
	File    string `yaml:"file,omitempty" json:"file"`       // path to spec file
	Enabled bool   `yaml:"enabled,omitempty" json:"enabled"` // default true when file present
}

type OpenAPITest struct {
	Enabled *bool `yaml:"enabled,omitempty" json:"enabled"` // override per-test
}

type JSHook struct {
	Code    string         `yaml:"code" json:"code"`
	Context map[string]any `yaml:"context,omitempty" json:"context"` // variables available to script
}
