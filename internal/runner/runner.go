package runner

import (
	"context"
	crand "crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	neturl "net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/dop251/goja"
	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/legacy"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/microsoft/go-mssqldb"
	"github.com/tidwall/gjson"
	"gopkg.in/yaml.v3"
	_ "modernc.org/sqlite"

	"github.com/DrWeltschmerz/HydReq/internal/httpclient"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
	"github.com/DrWeltschmerz/HydReq/pkg/assert"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// ErrSuiteNotRunnable signals configuration prevents execution (e.g., required baseUrl missing).
var ErrSuiteNotRunnable = errors.New("suite not runnable")

type Summary struct {
	Total    int
	Passed   int
	Failed   int
	Skipped  int
	Duration time.Duration
}

// Options controls runner behavior
type Options struct {
	Verbose          bool
	Tags             []string
	Workers          int
	OnResult         func(TestResult)
	OnStart          func(TestResult)
	DefaultTimeoutMs int             // default per-test request timeout when test.timeoutMs is not set
	oapi             *openapiRuntime // internal
}

// TestResult carries a single test outcome for reporting
type TestResult struct {
	Name       string
	Stage      int
	Tags       []string
	Status     string // passed|failed|skipped
	DurationMs int64
	Messages   []string
}

// internal case result type used between goroutines and runOne
type caseResult struct {
	extracted  map[string]string
	passed     bool
	failed     bool
	durationMs int64
	messages   []string
	name       string
	stage      int
	tags       []string
}

// genEmail creates a simple deterministic-looking random email for tests
func genEmail() string {
	var b [6]byte
	_, _ = crand.Read(b[:])
	local := hex.EncodeToString(b[:])
	return fmt.Sprintf("qa-%s@example.com", local)
}

type openapiRuntime struct {
	enabled bool
	doc     *openapi3.T
	router  routers.Router
}

func LoadSuite(path string) (*models.Suite, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var s models.Suite
	if err := yaml.Unmarshal(b, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

func RunSuite(ctx context.Context, s *models.Suite, opts Options) (Summary, error) {
	start := time.Now()
	vars := map[string]string{}
	for k, v := range s.Variables {
		vars[k] = v
	}
	var sum Summary

	// Identify if any test has Only=true; if so, skip others.
	only := false
	for _, t := range s.Tests {
		if t.Only {
			only = true
			break
		}
	}

	// Expand matrices
	testsExpanded := expandTestCases(s.Tests)

	// Preflight: if any request URL is relative/path-like and suite.baseUrl is empty after
	// interpolation, refuse to run the suite so we don't generate misleading request errors.
	{
		needBase := false
		for _, t := range testsExpanded {
			url := interpolate(t.Request.URL, vars)
			if !(strings.HasPrefix(strings.ToLower(url), "http://") || strings.HasPrefix(strings.ToLower(url), "https://")) {
				needBase = true
				break
			}
		}
		if needBase {
			base := strings.TrimSpace(interpolate(s.BaseURL, vars))
			if base == "" {
				sum.Duration = time.Since(start)
				return sum, fmt.Errorf("%w: baseUrl is empty; set suite.baseUrl or required environment", ErrSuiteNotRunnable)
			}
		}
	}

	// Run preSuite hooks sequentially (respect vars)
	if len(s.PreSuite) > 0 {
		for _, h := range s.PreSuite {
			if err := runHook(ctx, s, &vars, h, opts); err != nil {
				sum.Failed++
				sum.Duration = time.Since(start)
				return sum, fmt.Errorf("preSuite hook '%s' failed: %w", h.Name, err)
			}
		}
	}

	// Determine if DAG scheduling is requested
	hasDeps := false
	for _, t := range testsExpanded {
		if len(t.DependsOn) > 0 {
			hasDeps = true
			break
		}
	}

	// OpenAPI setup (optional)
	if s.OpenAPI != nil && s.OpenAPI.File != "" {
		// default enabled if file present unless explicitly disabled
		enabled := true
		if s.OpenAPI.Enabled == false {
			enabled = false
		}
		if enabled {
			loader := &openapi3.Loader{IsExternalRefsAllowed: true}
			if doc, err := loader.LoadFromFile(s.OpenAPI.File); err != nil {
				ui.Failf("OpenAPI load error: %v", err)
			} else if err := doc.Validate(ctx); err != nil {
				ui.Failf("OpenAPI spec invalid: %v", err)
			} else if rtr, err := legacy.NewRouter(doc); err != nil {
				ui.Failf("OpenAPI router error: %v", err)
			} else {
				opts.oapi = &openapiRuntime{enabled: true, doc: doc, router: rtr}
			}
		}
	}

	if hasDeps {
		if opts.Workers <= 0 {
			opts.Workers = 4
		}
		// 1) Initial filter (only/skip/tags) and build name->test map
		kept := make(map[string]models.TestCase)
		skipped := make(map[string]string) // name -> reason
		names := map[string]struct{}{}
		for _, t := range testsExpanded {
			if _, dup := names[t.Name]; dup {
				ui.Failf("duplicate test name: %s (required to use dependsOn)", t.Name)
				return sum, errors.New("duplicate test name with dependsOn")
			}
			names[t.Name] = struct{}{}
			if only && !t.Only {
				sum.Skipped++
				ui.Skipf("%s (only)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped", Messages: []string{"filtered by only"}})
				}
				skipped[t.Name] = "only"
				continue
			}
			if t.Skip {
				sum.Skipped++
				ui.Skipf("%s (skip)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped", Messages: []string{"explicit skip"}})
				}
				skipped[t.Name] = "skip"
				continue
			}
			if len(opts.Tags) > 0 && !anyTagMatch(t.Tags, opts.Tags) {
				sum.Skipped++
				ui.Skipf("%s (tags)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped", Messages: []string{"filtered by tags"}})
				}
				skipped[t.Name] = "tags"
				continue
			}
			kept[t.Name] = t
		}
		sum.Total = len(kept)

		// 2) Propagate dependency-filtering: if a test depends on a filtered test, skip it too
		changed := true
		for changed {
			changed = false
			for name, t := range kept {
				for _, dep := range t.DependsOn {
					if _, ok := kept[dep]; !ok { // dep missing or filtered
						// mark this as skipped due to dependency filtered
						sum.Skipped++
						ui.Skipf("%s (dep filtered: %s)", t.Name, dep)
						if opts.OnResult != nil {
							opts.OnResult(TestResult{Name: t.Name, Tags: t.Tags, Status: "skipped", Messages: []string{"dependency filtered: " + dep}})
						}
						delete(kept, name)
						skipped[name] = "dep-filtered"
						changed = true
						break
					}
				}
			}
		}

		// 3) Build DAG (edges: dep -> test)
		adj := make(map[string][]string)
		indeg := make(map[string]int)
		for name := range kept {
			indeg[name] = 0
		}
		for name, t := range kept {
			for _, dep := range t.DependsOn {
				// Only consider deps that remain in kept
				if _, ok := kept[dep]; ok {
					adj[dep] = append(adj[dep], name)
					indeg[name]++
				}
			}
		}

		// 4) Kahn layering with failure-propagation
		processed := make(map[string]bool)
		blocked := make(map[string]string) // name -> reason
		layer := 0
		for {
			// collect zero-indegree and not processed tests
			batch := make([]models.TestCase, 0)
			for name, t := range kept {
				if processed[name] {
					continue
				}
				if indeg[name] == 0 {
					batch = append(batch, t)
				}
			}
			if len(batch) == 0 {
				break
			}

			ui.Infof("Stage %d (%d tests)", layer, len(batch))
			// semaphore and channels
			sem := make(chan struct{}, opts.Workers)
			// buffer results so workers can complete and release the semaphore even if collector hasn't started reading yet
			done := make(chan caseResult, len(batch))

			// snapshot vars for layer
			baseVars := make(map[string]string, len(vars))
			for k, v := range vars {
				baseVars[k] = v
			}

			scheduled := 0
			for _, t := range batch {
				name := t.Name
				// if blocked by a failed dependency, skip now
				if _, isBlocked := blocked[name]; isBlocked {
					continue
				}
				sem <- struct{}{}
				scheduled++
				testVars := make(map[string]string, len(baseVars))
				for k, v := range baseVars {
					testVars[k] = v
				}
				// merge per-test vars before computing name
				if len(t.Vars) > 0 {
					for k, v := range t.Vars {
						testVars[k] = v
					}
				}
				if opts.OnStart != nil {
					nm := interpolate(t.Name, testVars)
					opts.OnStart(TestResult{Name: nm, Stage: layer, Tags: t.Tags, Status: "running"})
				}
				go func(tc models.TestCase, vv map[string]string) {
					defer func() { <-sem }()
					// pre hooks
					if len(tc.Pre) > 0 {
						_ = runHooksSequential(ctx, s, vv, tc.Pre, opts)
					}
					r := runOne(ctx, s, tc, vv, opts)
					r.name = tc.Name
					r.stage = layer
					r.tags = tc.Tags
					// post hooks (only run if test passed)
					if r.passed && len(tc.Post) > 0 {
						_ = runHooksSequential(ctx, s, vv, tc.Post, opts)
					}
					done <- r
				}(t, testVars)
			}

			for i := 0; i < scheduled; i++ {
				r := <-done
				processed[r.name] = true
				if r.failed {
					sum.Failed++
				} else if r.passed {
					sum.Passed++
				}
				for k, v := range r.extracted {
					vars[k] = v
				}
				if opts.OnResult != nil {
					status := "failed"
					if r.passed {
						status = "passed"
					}
					opts.OnResult(TestResult{Name: r.name, Stage: layer, Tags: r.tags, Status: status, DurationMs: r.durationMs, Messages: r.messages})
				}
				// on failure, mark descendants as blocked
				if r.failed {
					// BFS/DFS
					stack := []string{r.name}
					for len(stack) > 0 {
						cur := stack[len(stack)-1]
						stack = stack[:len(stack)-1]
						for _, child := range adj[cur] {
							if _, already := blocked[child]; !already {
								blocked[child] = "dependency failed: " + r.name
								// continue propagating
								stack = append(stack, child)
							}
						}
					}
				}
			}

			// reduce indegree for nodes after finishing this layer
			for _, t := range batch {
				name := t.Name
				for _, child := range adj[name] {
					indeg[child]--
				}
			}
			// Emit skips for any newly blocked nodes that became zero indegree but not yet processed
			for name, reason := range blocked {
				if processed[name] {
					continue
				}
				if indeg[name] <= 0 {
					processed[name] = true
					sum.Skipped++
					ui.Skipf("%s (%s)", name, reason)
					if opts.OnResult != nil {
						opts.OnResult(TestResult{Name: name, Stage: layer, Status: "skipped", Messages: []string{reason}})
					}
				}
			}
			layer++
		}

		// Any remaining unprocessed nodes imply a cycle or unresolved deps
		for name := range kept {
			if !processed[name] {
				sum.Skipped++
				ui.Skipf("%s (cyclic or unresolved deps)", name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: name, Status: "skipped", Messages: []string{"cyclic or unresolved deps"}})
				}
			}
		}
	} else {
		// Filter and group by stage (legacy path)
		byStage := map[int][]models.TestCase{}
		for _, t := range testsExpanded {
			if only && !t.Only {
				sum.Skipped++
				ui.Skipf("%s (only)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped"})
				}
				continue
			}
			if t.Skip {
				sum.Skipped++
				ui.Skipf("%s (skip)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped"})
				}
				continue
			}
			if len(opts.Tags) > 0 && !anyTagMatch(t.Tags, opts.Tags) {
				sum.Skipped++
				ui.Skipf("%s (tags)", t.Name)
				if opts.OnResult != nil {
					opts.OnResult(TestResult{Name: t.Name, Stage: t.Stage, Tags: t.Tags, Status: "skipped"})
				}
				continue
			}
			sum.Total++
			byStage[t.Stage] = append(byStage[t.Stage], t)
		}
		if opts.Workers <= 0 {
			opts.Workers = 4
		}
		stages := make([]int, 0, len(byStage))
		for st := range byStage {
			stages = append(stages, st)
		}
		sort.Ints(stages)

		for _, st := range stages {
			tests := byStage[st]
			if len(tests) == 0 {
				continue
			}
			ui.Infof("Stage %d (%d tests)", st, len(tests))

			sem := make(chan struct{}, opts.Workers)
			// buffer to number of tests in this stage to avoid deadlocks
			done := make(chan caseResult, len(tests))

			baseVars := make(map[string]string, len(vars))
			for k, v := range vars {
				baseVars[k] = v
			}

			scheduled := 0
			for _, t := range tests {
				sem <- struct{}{}
				scheduled++
				testVars := make(map[string]string, len(baseVars))
				for k, v := range baseVars {
					testVars[k] = v
				}
				// merge per-test vars before computing name
				if len(t.Vars) > 0 {
					for k, v := range t.Vars {
						testVars[k] = v
					}
				}
				if opts.OnStart != nil {
					nm := interpolate(t.Name, testVars)
					opts.OnStart(TestResult{Name: nm, Stage: t.Stage, Tags: t.Tags, Status: "running"})
				}
				go func(tc models.TestCase, vv map[string]string) {
					defer func() { <-sem }()
					if len(tc.Pre) > 0 {
						_ = runHooksSequential(ctx, s, vv, tc.Pre, opts)
					}
					r := runOne(ctx, s, tc, vv, opts)
					r.name = tc.Name
					r.stage = tc.Stage
					r.tags = tc.Tags
					if r.passed && len(tc.Post) > 0 {
						_ = runHooksSequential(ctx, s, vv, tc.Post, opts)
					}
					done <- r
				}(t, testVars)
			}

			for i := 0; i < scheduled; i++ {
				r := <-done
				if r.failed {
					sum.Failed++
				}
				if r.passed {
					sum.Passed++
				}
				for k, v := range r.extracted {
					vars[k] = v
				}
				if opts.OnResult != nil {
					status := "failed"
					if r.passed {
						status = "passed"
					}
					opts.OnResult(TestResult{Name: r.name, Stage: r.stage, Tags: r.tags, Status: status, DurationMs: r.durationMs, Messages: r.messages})
				}
			}
		}
	}
	// postSuite hooks
	if len(s.PostSuite) > 0 {
		for _, h := range s.PostSuite {
			if err := runHook(ctx, s, &vars, h, opts); err != nil {
				// treat postSuite failure as suite failure
				sum.Failed++
				break
			}
		}
	}

	sum.Duration = time.Since(start)
	if sum.Failed > 0 {
		return sum, errors.New("test failures")
	}
	return sum, nil
}

// runOne executes a single test case and returns result (without mutating shared state)
func runOne(ctx context.Context, s *models.Suite, t models.TestCase, vars map[string]string, opts Options) (res caseResult) {
	// merge per-test vars into local copy
	if len(t.Vars) > 0 {
		for k, v := range t.Vars {
			vars[k] = v
		}
	}

	name := interpolate(t.Name, vars)
	// allow environment or vars to control baseUrl
	base := interpolate(s.BaseURL, vars)
	reqURL := resolveURL(base, interpolate(t.Request.URL, vars))
	headers := make(map[string]string, len(t.Request.Headers))
	for k, v := range t.Request.Headers {
		headers[k] = interpolate(v, vars)
	}
	query := make(map[string]string, len(t.Request.Query))
	for k, v := range t.Request.Query {
		query[k] = interpolate(v, vars)
	}
	body := interpolateAny(t.Request.Body, vars)

	// Inject auth if configured and header not already set
	if s.Auth != nil {
		if _, ok := headers["Authorization"]; !ok {
			if s.Auth.BearerEnv != "" {
				if token := os.Getenv(s.Auth.BearerEnv); token != "" {
					headers["Authorization"] = "Bearer " + token
				}
			} else if s.Auth.BasicEnv != "" {
				if creds := os.Getenv(s.Auth.BasicEnv); creds != "" {
					enc := base64.StdEncoding.EncodeToString([]byte(creds))
					headers["Authorization"] = "Basic " + enc
				}
			}
		}
	}

	defTimeout := opts.DefaultTimeoutMs
	if defTimeout <= 0 {
		defTimeout = 30_000
	}
	client := httpclient.New(durationFromMs(t.TimeoutMs, defTimeout))
	repeats := repeatsFor(t)
	var lastErr error
	var lastResp *httpclient.Response
	for i := 0; i < repeats; i++ {
		ctxReq, cancel := context.WithTimeout(ctx, durationFromMs(t.TimeoutMs, defTimeout))
		resp, err := client.Do(ctxReq, strings.ToUpper(t.Request.Method), reqURL, headers, query, body)
		cancel()
		lastErr = err
		lastResp = resp
		if err == nil {
			break
		}
		if t.Retry != nil && t.Retry.BackoffMs > 0 {
			d := time.Duration(t.Retry.BackoffMs) * time.Millisecond
			if t.Retry.JitterPct > 0 {
				d = withJitter(d, t.Retry.JitterPct)
			}
			time.Sleep(d)
		}
	}
	if lastErr != nil {
		ui.Failf("%s: request error: %v", name, lastErr)
		res.failed = true
		res.messages = append(res.messages, fmt.Sprintf("request error: %v", lastErr))
		return
	}

	// Assertions
	results := []assert.Result{}
	if t.Assert.Status != 0 {
		results = append(results, assert.Equal(lastResp.Status, t.Assert.Status, "status"))
	}
	for hk, hv := range t.Assert.HeaderEquals {
		got := lastResp.Headers.Get(hk)
		results = append(results, assert.Equal(got, interpolate(hv, vars), "header:"+hk))
	}
	for path, exp := range t.Assert.JSONEquals {
		val := gjson.GetBytes(lastResp.Body, path)
		expected := interpolate(anyToString(exp), vars)
		results = append(results, assert.Equal(anyToString(val.Value()), expected, "json:"+path))
	}
	for path, exp := range t.Assert.JSONContains {
		val := gjson.GetBytes(lastResp.Body, path)
		expected := interpolate(anyToString(exp), vars)
		results = append(results, assert.Contains(anyToString(val.Value()), expected, "json-contains:"+path))
	}
	for _, sub := range t.Assert.BodyContains {
		results = append(results, assert.Contains(string(lastResp.Body), interpolate(sub, vars), "body"))
	}
	// Optional OpenAPI response validation (if configured and enabled)
	if opts.oapi != nil && opts.oapi.enabled {
		enabled := true
		if t.OpenAPI != nil && t.OpenAPI.Enabled != nil {
			enabled = *t.OpenAPI.Enabled
		}
		if enabled {
			ctype := lastResp.Headers.Get("Content-Type")
			if strings.Contains(strings.ToLower(ctype), "json") {
				// Build http.Request for route matching (path only)
				pu, _ := neturl.Parse(reqURL)
				req, _ := http.NewRequestWithContext(ctx, strings.ToUpper(t.Request.Method), pu.Path, nil)
				route, pathParams, err := opts.oapi.router.FindRoute(req)
				if err != nil {
					results = append(results, assert.Result{Passed: false, Msg: fmt.Sprintf("openapi route not found: %v", err)})
				} else {
					in := &openapi3filter.RequestValidationInput{Request: req, PathParams: pathParams, Route: route}
					rvi := &openapi3filter.ResponseValidationInput{RequestValidationInput: in, Status: lastResp.Status, Header: lastResp.Headers}
					rvi.SetBodyBytes(lastResp.Body)
					if err := openapi3filter.ValidateResponse(ctx, rvi); err != nil {
						results = append(results, assert.Result{Passed: false, Msg: fmt.Sprintf("openapi: %v", err)})
					} else {
						results = append(results, assert.Result{Passed: true, Msg: "openapi: ok"})
					}
				}
			}
		}
	}
	if t.Assert.MaxDurationMs > 0 {
		if lastResp.DurationMs > t.Assert.MaxDurationMs {
			results = append(results, assert.Equal(lastResp.DurationMs, t.Assert.MaxDurationMs, "durationMs<="))
		} else {
			results = append(results, assert.Result{Passed: true, Msg: fmt.Sprintf("durationMs: %d <= %d", lastResp.DurationMs, t.Assert.MaxDurationMs)})
		}
	}
	failed := false
	for _, r := range results {
		if !r.Passed {
			failed = true
			res.messages = append(res.messages, r.Msg)
			break
		}
	}
	if failed {
		ui.Failf("%s", name)
		if opts.Verbose {
			for _, r := range results {
				if !r.Passed {
					ui.Detail(r.Msg)
				}
			}
			ui.Detail(fmt.Sprintf("Response: status=%d, ms=%d", lastResp.Status, lastResp.DurationMs))
			ui.CodeBlock(truncate(string(lastResp.Body), 500))
		}
		res.failed = true
		res.durationMs = lastResp.DurationMs
		return
	}

	// Extract
	res.extracted = map[string]string{}
	for key, ex := range t.Extract {
		v := gjson.GetBytes(lastResp.Body, ex.JSONPath)
		res.extracted[key] = fmt.Sprintf("%v", v.Value())
	}
	ui.Successf("%s (%d ms)", name, lastResp.DurationMs)
	res.passed = true
	res.durationMs = lastResp.DurationMs
	return
}

func interpolate(s string, vars map[string]string) string {
	res := s
	for k, v := range vars {
		res = strings.ReplaceAll(res, "${"+k+"}", v)
	}
	// ${ENV:VAR} expansion
	for {
		start := strings.Index(res, "${ENV:")
		if start < 0 {
			break
		}
		end := strings.Index(res[start:], "}")
		if end < 0 {
			break
		}
		end += start
		key := res[start+6 : end]
		val := os.Getenv(key)
		// fallback to vars map if env not set
		if val == "" {
			if v, ok := vars[key]; ok {
				val = v
			}
		}
		res = res[:start] + val + res[end+1:]
	}
	// Special generators: ${FAKE:uuid}, ${NOW:layout}, ${RANDINT:min:max}
	res = expandGenerators(res)
	return res
}

// interpolateAny walks common JSON-like structures and interpolates strings.
func interpolateAny(v any, vars map[string]string) any {
	switch t := v.(type) {
	case nil:
		return nil
	case string:
		return interpolate(t, vars)
	case []byte:
		return []byte(interpolate(string(t), vars))
	case []any:
		out := make([]any, len(t))
		for i := range t {
			out[i] = interpolateAny(t[i], vars)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, vv := range t {
			out[k] = interpolateAny(vv, vars)
		}
		return out
	default:
		return v
	}
}

func resolveURL(base, path string) string {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return path
	}
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}

func anyToString(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	default:
		return fmt.Sprintf("%v", t)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func durationFromMs(ms int, def int) time.Duration {
	if ms <= 0 {
		return time.Duration(def) * time.Millisecond
	}
	return time.Duration(ms) * time.Millisecond
}

func anyTagMatch(have, want []string) bool {
	if len(want) == 0 {
		return true
	}
	m := map[string]struct{}{}
	for _, t := range have {
		m[strings.ToLower(strings.TrimSpace(t))] = struct{}{}
	}
	for _, w := range want {
		if _, ok := m[strings.ToLower(strings.TrimSpace(w))]; ok {
			return true
		}
	}
	return false
}

func withJitter(d time.Duration, pct int) time.Duration {
	if pct <= 0 {
		return d
	}
	n := time.Now().UnixNano()
	sign := int64(1)
	if n%2 == 0 {
		sign = -1
	}
	delta := time.Duration(int64(d) * int64(pct) / 100)
	if delta <= 0 {
		return d
	}
	jitter := time.Duration(sign * (n % int64(delta)))
	return d + jitter
}

// expandTestCases applies the cartesian product of matrix variables to create multiple cases
func expandTestCases(tests []models.TestCase) []models.TestCase {
	out := make([]models.TestCase, 0, len(tests))
	for _, t := range tests {
		if len(t.Matrix) == 0 {
			out = append(out, t)
			continue
		}
		keys := make([]string, 0, len(t.Matrix))
		for k := range t.Matrix {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		// build product
		combos := [][][2]string{{}}
		for _, k := range keys {
			vals := t.Matrix[k]
			next := make([][][2]string, 0, len(combos)*len(vals))
			for _, c := range combos {
				for _, v := range vals {
					nc := make([][2]string, len(c)+1)
					copy(nc, c)
					nc[len(c)] = [2]string{k, v}
					next = append(next, nc)
				}
			}
			combos = next
		}
		for _, c := range combos {
			tc := t // copy
			if tc.Vars == nil {
				tc.Vars = map[string]string{}
			}
			suffixParts := make([]string, 0, len(c))
			for _, kv := range c {
				tc.Vars[kv[0]] = kv[1]
				suffixParts = append(suffixParts, fmt.Sprintf("%s=%s", kv[0], kv[1]))
			}
			tc.Name = fmt.Sprintf("%s [%s]", t.Name, strings.Join(suffixParts, ","))
			out = append(out, tc)
		}
	}
	return out
}

// repeatsFor decides how many attempts to make based on Repeat and Retry.Max
func repeatsFor(t models.TestCase) int {
	r := t.Repeat
	if t.Retry != nil && t.Retry.Max > r {
		r = t.Retry.Max
	}
	if r <= 0 {
		r = 1
	}
	return r
}

// runHook executes a single hook: merges Vars, performs optional HTTP request with assertions, and extracts vars.
func runHook(ctx context.Context, s *models.Suite, vars *map[string]string, h models.Hook, opts Options) error {
	// merge vars first (with interpolation support)
	if len(h.Vars) > 0 {
		for k, v := range h.Vars {
			(*vars)[k] = interpolate(v, *vars)
		}
	}
	// SQL action
	if h.SQL != nil {
		drv := interpolate(h.SQL.Driver, *vars)
		dsn := interpolate(h.SQL.DSN, *vars)
		db, err := sql.Open(drv, dsn)
		if err != nil {
			return err
		}
		defer db.Close()
		q := interpolate(h.SQL.Query, *vars)
		rows, qerr := db.QueryContext(ctx, q)
		if qerr != nil {
			if _, e := db.ExecContext(ctx, q); e != nil {
				return e
			}
		} else {
			defer rows.Close()
			cols, _ := rows.Columns()
			if rows.Next() {
				vals := make([]any, len(cols))
				ptrs := make([]any, len(cols))
				for i := range vals {
					ptrs[i] = &vals[i]
				}
				if err := rows.Scan(ptrs...); err == nil {
					m := map[string]string{}
					for i, c := range cols {
						v := vals[i]
						switch vv := v.(type) {
						case []byte:
							m[c] = string(vv)
						case nil:
							m[c] = ""
						default:
							m[c] = fmt.Sprintf("%v", vv)
						}
					}
					for varName, col := range h.SQL.Extract {
						(*vars)[varName] = m[col]
					}
				}
			}
		}
	}
	// JS action
	if h.JS != nil {
		if err := RunJSHook(h.JS, vars); err != nil {
			return err
		}
	}
	if h.Request == nil {
		return nil
	}
	// construct a temporary test case from hook
	tc := models.TestCase{
		Name:    "hook: " + h.Name,
		Request: *h.Request,
		Assert:  h.Assert,
		Extract: h.Extract,
	}
	// local copy of vars for the HTTP call
	vv := make(map[string]string, len(*vars))
	for k, v := range *vars {
		vv[k] = v
	}
	r := runOne(ctx, s, tc, vv, opts)
	if r.failed {
		// Summarize messages
		msg := "hook failed"
		if len(r.messages) > 0 {
			msg = strings.Join(r.messages, "; ")
		}
		return errors.New(msg)
	}
	if len(r.extracted) > 0 {
		for k, v := range r.extracted {
			(*vars)[k] = v
		}
	}
	return nil
}

// RunJSHook executes JavaScript code with access to variables
func RunJSHook(jsHook *models.JSHook, vars *map[string]string) error {
	vm := goja.New()

	// Set up context variables
	varsObj := vm.NewObject()
	for k, v := range *vars {
		varsObj.Set(k, v)
	}
	vm.Set("vars", varsObj)

	// Set up utility functions
	vm.Set("setVar", func(name, value string) {
		(*vars)[name] = value
		varsObj.Set(name, value) // Update JS object too
	})

	vm.Set("getVar", func(name string) string {
		return (*vars)[name]
	})

	// Add context variables if provided
	if jsHook.Context != nil {
		for k, v := range jsHook.Context {
			vm.Set(k, v)
		}
	}

	// Execute the JavaScript code
	_, err := vm.RunString(jsHook.Code)
	return err
}

// Generators expansion helpers
func expandGenerators(s string) string {
	// UUIDs
	for strings.Contains(s, "${FAKE:uuid}") {
		s = strings.Replace(s, "${FAKE:uuid}", genUUIDv4(), 1)
	}
	// EMAIL
	for strings.Contains(s, "${EMAIL}") {
		s = strings.Replace(s, "${EMAIL}", genEmail(), 1)
	}
	// NOW and NOW with offset: ${NOW:layout} or ${NOW+/-offset:layout} (offset units: s,m,h,d,w)
	nowRe := regexp.MustCompile(`\$\{NOW(?:([-+])(\d+)([smhdw]))?:([^}]+)\}`)
	for {
		m := nowRe.FindStringSubmatchIndex(s)
		if m == nil {
			break
		}
		sign := ""
		amount := ""
		unit := ""
		layout := ""
		if len(m) >= 10 {
			if m[2] != -1 {
				sign = s[m[2]:m[3]]
			}
			if m[4] != -1 {
				amount = s[m[4]:m[5]]
			}
			if m[6] != -1 {
				unit = s[m[6]:m[7]]
			}
			if m[8] != -1 {
				layout = s[m[8]:m[9]]
			}
		}
		delta := time.Duration(0)
		if amount != "" && unit != "" {
			var n int
			fmt.Sscanf(amount, "%d", &n)
			switch unit {
			case "s":
				delta = time.Duration(n) * time.Second
			case "m":
				delta = time.Duration(n) * time.Minute
			case "h":
				delta = time.Duration(n) * time.Hour
			case "d":
				delta = time.Duration(n) * 24 * time.Hour
			case "w":
				delta = time.Duration(n) * 7 * 24 * time.Hour
			}
			if sign == "-" {
				delta = -delta
			}
		}
		t := time.Now().Add(delta)
		repl := t.Format(layout)
		s = s[:m[0]] + repl + s[m[1]:]
	}
	// RANDINT:min:max
	rndRe := regexp.MustCompile(`\$\{RANDINT:(-?\d+):(-?\d+)\}`)
	rand.Seed(time.Now().UnixNano())
	for {
		m := rndRe.FindStringSubmatchIndex(s)
		if m == nil {
			break
		}
		minStr := s[m[2]:m[3]]
		maxStr := s[m[4]:m[5]]
		var min, max int
		fmt.Sscanf(minStr, "%d", &min)
		fmt.Sscanf(maxStr, "%d", &max)
		if max < min {
			min, max = max, min
		}
		n := min
		if max > min {
			n = min + rand.Intn(max-min+1)
		}
		repl := fmt.Sprintf("%d", n)
		s = s[:m[0]] + repl + s[m[1]:]
	}
	return s
}

func genUUIDv4() string {
	var b [16]byte
	_, _ = crand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	x := hex.EncodeToString(b[:])
	return fmt.Sprintf("%s-%s-%s-%s-%s", x[0:8], x[8:12], x[12:16], x[16:20], x[20:32])
}

// runHooksSequential runs hooks in order, mutating the provided vars map (shared across hooks)
func runHooksSequential(ctx context.Context, s *models.Suite, vars map[string]string, hooks []models.Hook, opts Options) error {
	for _, h := range hooks {
		if err := runHook(ctx, s, &vars, h, opts); err != nil {
			return err
		}
	}
	return nil
}
