package webui

import (
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	neturl "net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/DrWeltschmerz/HydReq/internal/runner"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
	"github.com/getkin/kin-openapi/openapi3"
	routers "github.com/getkin/kin-openapi/routers"
	legacy "github.com/getkin/kin-openapi/routers/legacy"
	"gopkg.in/yaml.v3"
)

//go:embed static/*
var staticFS embed.FS

type server struct {
	mux     *http.ServeMux
	streams map[string]chan string
	mu      sync.Mutex
	envMu   sync.Mutex
	runs    map[string]context.CancelFunc
	ready   map[string]chan struct{}
}

func Run(addr string, openBrowser bool) error {
	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}}
	s.routes()
	srv := &http.Server{Addr: addr, Handler: s.mux}
	url := fmt.Sprintf("http://%s", addr)
	log.Printf("HydReq GUI listening on %s", url)
	if openBrowser {
		go tryOpen(url)
	}
	return srv.ListenAndServe()
}

func (s *server) routes() {
	s.mux.HandleFunc("/api/suites", s.handleSuites)
	s.mux.HandleFunc("/api/run", s.handleRun)
	s.mux.HandleFunc("/api/stream", s.handleStream)
	s.mux.HandleFunc("/api/cancel", s.handleCancel)
	// Editor endpoints (MVP)
	s.mux.HandleFunc("/api/editor/suites", s.handleEditorSuites)
	s.mux.HandleFunc("/api/editor/suite", s.handleEditorSuite)
	s.mux.HandleFunc("/api/editor/validate", s.handleEditorValidate)
	s.mux.HandleFunc("/api/editor/save", s.handleEditorSave)
	// Editor quick-run for a single test (in-memory)
	s.mux.HandleFunc("/api/editor/testrun", s.handleEditorTestRun)
	// Env check for auth UX
	s.mux.HandleFunc("/api/editor/envcheck", s.handleEditorEnvCheck)
	// Run a single hook (suite/test; pre/post)
	s.mux.HandleFunc("/api/editor/hookrun", s.handleEditorHookRun)
	// Serve the embedded static/ directory at the root so / loads index.html directly
	// Serve embedded static files with no-cache headers to prevent stale UI during local dev
	if sub, err := fs.Sub(staticFS, "static"); err == nil {
		fsHandler := http.FileServer(http.FS(sub))
		s.mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			fsHandler.ServeHTTP(w, r)
		}))
	} else {
		fsHandler := http.FileServer(http.FS(staticFS))
		s.mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			fsHandler.ServeHTTP(w, r)
		}))
	}
}

func (s *server) handleSuites(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	list := findSuites()
	json.NewEncoder(w).Encode(list)
}

// ---- Editor API (MVP) ----
// Restrict edits to files under testdata/ and with .yml/.yaml suffix.
func isEditablePath(p string) bool {
	if p == "" {
		return false
	}
	cp := filepath.Clean(p)
	if !strings.HasSuffix(cp, ".yaml") && !strings.HasSuffix(cp, ".yml") {
		return false
	}
	// ensure under testdata/
	if !strings.HasPrefix(cp, "testdata/") && cp != "testdata" {
		return false
	}
	if info, err := os.Stat(cp); err == nil && info.IsDir() {
		return false
	}
	return true
}

func (s *server) handleEditorSuites(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(405)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	list := findSuites()
	type item struct {
		Path string `json:"path"`
	}
	out := make([]item, 0, len(list))
	for _, p := range list {
		out = append(out, item{Path: p})
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (s *server) handleEditorSuite(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		path := r.URL.Query().Get("path")
		if !isEditablePath(path) {
			w.WriteHeader(400)
			_, _ = w.Write([]byte("invalid path"))
			return
		}
		b, err := os.ReadFile(path)
		if err != nil {
			w.WriteHeader(404)
			return
		}
		// Best-effort parse: try to unmarshal YAML; if it fails, still return raw content
		var suite models.Suite
		var parsed *models.Suite
		var perr string
		if err := yaml.Unmarshal(b, &suite); err == nil {
			sc := suite
			parsed = &sc
		} else {
			perr = err.Error()
		}
		w.Header().Set("Content-Type", "application/json")
		resp := map[string]any{"raw": string(b)}
		if parsed != nil {
			resp["parsed"] = parsed
		}
		if perr != "" {
			resp["error"] = perr
		}
		_ = json.NewEncoder(w).Encode(resp)
	default:
		w.WriteHeader(405)
	}
}

type validateReq struct {
	Raw    string      `json:"raw"`
	Parsed interface{} `json:"parsed"`
}
type validateResp struct {
	OK     bool             `json:"ok"`
	Issues []map[string]any `json:"issues"`
	Parsed *models.Suite    `json:"parsed,omitempty"`
	YAML   string           `json:"yaml,omitempty"`
}

func (s *server) handleEditorValidate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var vr validateReq
	if err := json.NewDecoder(r.Body).Decode(&vr); err != nil {
		w.WriteHeader(400)
		return
	}
	issues := []map[string]any{}
	var parsed models.Suite
	var parsedValid bool
	// prefer raw if provided
	if strings.TrimSpace(vr.Raw) != "" {
		raw := vr.Raw
		if err := yaml.Unmarshal([]byte(raw), &parsed); err != nil {
			// Friendlier YAML error formatting
			msg := err.Error()
			// Extract line number if present in error (e.g., "line 17: ...")
			lineInfo := ""
			if i := strings.Index(msg, "line "); i >= 0 {
				// crude parse of number after "line "
				rest := msg[i+5:]
				num := ""
				for _, ch := range rest {
					if ch >= '0' && ch <= '9' {
						num += string(ch)
					} else {
						break
					}
				}
				if num != "" {
					lineInfo = num
				}
			}
			// Detect tabs in raw and include a clear hint
			hasTabs := strings.Contains(raw, "\t")
			hint := ""
			if hasTabs {
				if lineInfo == "" {
					// try to find first line with a tab
					lines := strings.Split(raw, "\n")
					for idx, ln := range lines {
						if strings.Contains(ln, "\t") {
							lineInfo = fmt.Sprintf("%d", idx+1)
							break
						}
					}
				}
				hint = "YAML uses spaces for indentation. Replace tabs (\t) with two spaces."
			}
			friendly := "YAML parse error"
			if lineInfo != "" {
				friendly += " at line " + lineInfo
			}
			if hint != "" {
				friendly += ": " + hint
			}
			issues = append(issues, map[string]any{"path": "root", "message": friendly, "severity": "error"})
			// also include original parser message as info for debugging
			issues = append(issues, map[string]any{"path": "root", "message": msg, "severity": "info"})
		} else {
			parsedValid = true
		}
	} else if vr.Parsed != nil {
		// re-marshal+unmarshal to models.Suite
		if b, err := json.Marshal(vr.Parsed); err == nil {
			if err := json.Unmarshal(b, &parsed); err != nil {
				issues = append(issues, map[string]any{"path": "root", "message": err.Error(), "severity": "error"})
			} else {
				parsedValid = true
			}
		} else {
			issues = append(issues, map[string]any{"path": "root", "message": err.Error(), "severity": "error"})
		}
	} else {
		issues = append(issues, map[string]any{"path": "root", "message": "no content to validate", "severity": "error"})
	}
	// minimal engine validations (examples)
	// duplicate test names when using dependsOn
	names := map[string]struct{}{}
	for _, t := range parsed.Tests {
		if _, ok := names[t.Name]; ok {
			issues = append(issues, map[string]any{"path": "tests[].name", "message": "duplicate test name: " + t.Name, "severity": "error"})
		}
		names[t.Name] = struct{}{}
	}
	// Additional validations when model parsed (even if some issues exist, we can still analyze fields)
	// Only run if parsed has some content (Name/tests may be zero-value)
	if len(parsed.Tests) > 0 || parsed.Name != "" {
		// suite-level checks
		if strings.TrimSpace(parsed.BaseURL) == "" {
			issues = append(issues, map[string]any{"path": "baseUrl", "message": "baseUrl is empty (requests should use path only)", "severity": "warning"})
		}
		if parsed.Auth != nil {
			if strings.TrimSpace(parsed.Auth.BearerEnv) != "" {
				if _, ok := os.LookupEnv(parsed.Auth.BearerEnv); !ok {
					issues = append(issues, map[string]any{"path": "auth.bearerEnv", "message": "environment variable not set: " + parsed.Auth.BearerEnv, "severity": "info"})
				}
			}
			if strings.TrimSpace(parsed.Auth.BasicEnv) != "" {
				if _, ok := os.LookupEnv(parsed.Auth.BasicEnv); !ok {
					issues = append(issues, map[string]any{"path": "auth.basicEnv", "message": "environment variable not set: " + parsed.Auth.BasicEnv, "severity": "info"})
				}
			}
		}
		// OpenAPI checks (optional)
		var oapiRouter routers.Router
		if parsed.OpenAPI != nil && strings.TrimSpace(parsed.OpenAPI.File) != "" {
			loader := &openapi3.Loader{IsExternalRefsAllowed: true}
			if doc, err := loader.LoadFromFile(parsed.OpenAPI.File); err == nil {
				if rtr, err := legacy.NewRouter(doc); err == nil {
					oapiRouter = rtr
				}
			}
		}
		// Per-test checks
		for i, t := range parsed.Tests {
			pathBase := fmt.Sprintf("tests[%d]", i)
			// request method/url
			m := strings.ToUpper(strings.TrimSpace(t.Request.Method))
			if m == "" {
				issues = append(issues, map[string]any{"path": pathBase + ".request.method", "message": "method is empty", "severity": "error"})
			} else {
				switch m {
				case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS":
				default:
					issues = append(issues, map[string]any{"path": pathBase + ".request.method", "message": "uncommon HTTP method: " + m, "severity": "warning"})
				}
				// openapi route existence
				if oapiRouter != nil && strings.TrimSpace(t.Request.URL) != "" {
					// Build a minimal http.Request for router matching
					p := strings.TrimSpace(t.Request.URL)
					// if starts with http, parse and get Path; else ensure leading '/'
					if strings.HasPrefix(p, "http://") || strings.HasPrefix(p, "https://") {
						if u, err := neturl.Parse(p); err == nil {
							p = u.Path
						}
					} else if !strings.HasPrefix(p, "/") {
						p = "/" + p
					}
					req := &http.Request{Method: strings.ToUpper(strings.TrimSpace(t.Request.Method)), URL: &neturl.URL{Path: p}}
					if _, _, err := oapiRouter.FindRoute(req); err != nil {
						issues = append(issues, map[string]any{"path": pathBase + ".request.url", "message": "OpenAPI: route not found for method/path", "severity": "warning"})
					}
				}
			}
			if strings.TrimSpace(t.Request.URL) == "" {
				issues = append(issues, map[string]any{"path": pathBase + ".request.url", "message": "url is empty", "severity": "error"})
			} else if strings.HasPrefix(strings.TrimSpace(t.Request.URL), "http") {
				issues = append(issues, map[string]any{"path": pathBase + ".request.url", "message": "URL should be a path; baseUrl lives in suite.baseUrl", "severity": "warning"})
			}
			// stage non-negative
			if t.Stage < 0 {
				issues = append(issues, map[string]any{"path": pathBase + ".stage", "message": "stage must be >= 0", "severity": "error"})
			}
			// retry reasonable bounds
			if t.Retry != nil {
				if t.Retry.Max < 0 {
					issues = append(issues, map[string]any{"path": pathBase + ".retry.max", "message": "retry.max must be >= 0", "severity": "error"})
				}
				if t.Retry.JitterPct < 0 || t.Retry.JitterPct > 100 {
					issues = append(issues, map[string]any{"path": pathBase + ".retry.jitterPct", "message": "retry.jitterPct should be 0..100", "severity": "error"})
				}
				if t.Retry.BackoffMs < 0 {
					issues = append(issues, map[string]any{"path": pathBase + ".retry.backoffMs", "message": "retry.backoffMs must be >= 0", "severity": "error"})
				}
			}
			// matrix types
			if len(t.Matrix) > 0 {
				for k, arr := range t.Matrix {
					if len(arr) == 0 {
						issues = append(issues, map[string]any{"path": pathBase + ".matrix." + k, "message": "matrix entry has no values", "severity": "warning"})
					}
				}
			}
			// extract jsonPaths basic shape (gjson paths, e.g. json.id or data.items.0.id)
			if len(t.Extract) > 0 {
				for varName, ex := range t.Extract {
					jp := strings.TrimSpace(ex.JSONPath)
					if jp == "" {
						issues = append(issues, map[string]any{"path": pathBase + ".extract." + varName, "message": "jsonPath empty", "severity": "error"})
						continue
					}
					// We use gjson for extraction; gjson paths should NOT start with '$'.
					if strings.HasPrefix(jp, "$") {
						issues = append(issues, map[string]any{"path": pathBase + ".extract." + varName, "message": "jsonPath uses '$' prefix, but gjson expects paths like json.id (no $)", "severity": "warning"})
					}
				}
			}
			// assertions
			if t.Assert.Status == 0 {
				issues = append(issues, map[string]any{"path": pathBase + ".assert.status", "message": "status is 0; did you intend to assert HTTP code?", "severity": "warning"})
			}
			if t.Assert.MaxDurationMs < 0 {
				issues = append(issues, map[string]any{"path": pathBase + ".assert.maxDurationMs", "message": "maxDurationMs must be >= 0", "severity": "error"})
			}
		}
		// dependsOn names exist
		known := map[string]struct{}{}
		for _, t := range parsed.Tests {
			if t.Name != "" {
				known[t.Name] = struct{}{}
			}
		}
		for i, t := range parsed.Tests {
			for _, dep := range t.DependsOn {
				if _, ok := known[dep]; !ok {
					issues = append(issues, map[string]any{"path": fmt.Sprintf("tests[%d].dependsOn", i), "message": "unknown dependency: " + dep, "severity": "error"})
				}
			}
		}
	}
	ok := true
	for _, it := range issues {
		if it["severity"] == "error" {
			ok = false
			break
		}
	}
	// Include parsed only if we successfully parsed input
	var parsedPtr *models.Suite
	var outYAML string
	if parsedValid {
		parsedCopy := parsed
		parsedPtr = &parsedCopy
	}
	// YAML preview/content: when validating raw, echo the raw text; when validating parsed, render canonical YAML
	if strings.TrimSpace(vr.Raw) != "" {
		outYAML = vr.Raw
	} else if parsedValid {
		var buf strings.Builder
		enc := yaml.NewEncoder(&buf)
		enc.SetIndent(2)
		_ = enc.Encode(&parsed)
		_ = enc.Close()
		outYAML = buf.String()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(validateResp{OK: ok, Issues: issues, Parsed: parsedPtr, YAML: outYAML})
}

type saveReq struct {
	Path   string      `json:"path"`
	Parsed interface{} `json:"parsed"`
	Raw    string      `json:"raw,omitempty"`
}

func (s *server) handleEditorSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var sr saveReq
	if err := json.NewDecoder(r.Body).Decode(&sr); err != nil {
		w.WriteHeader(400)
		return
	}
	if !isEditablePath(sr.Path) {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("invalid path"))
		return
	}
	// If raw is provided, save it as-is (assumes caller validated it). This preserves comments/order.
	if strings.TrimSpace(sr.Raw) != "" {
		if err := atomicWriteWithBackup(sr.Path, []byte(sr.Raw)); err != nil {
			w.WriteHeader(500)
			_, _ = w.Write([]byte(err.Error()))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"saved": true, "yaml": sr.Raw})
		return
	}
	// coerce into models.Suite
	var suite models.Suite
	bjson, err := json.Marshal(sr.Parsed)
	if err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("bad payload"))
		return
	}
	if err := json.Unmarshal(bjson, &suite); err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("bad suite model"))
		return
	}
	// regenerate YAML with stable formatting for MVP
	y := &yaml.Node{Kind: yaml.DocumentNode}
	if err := y.Encode(suite); err != nil {
		w.WriteHeader(500)
		return
	}
	var buf strings.Builder
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(&suite); err != nil {
		w.WriteHeader(500)
		return
	}
	_ = enc.Close()
	newYAML := buf.String()
	// atomic save with backup
	if err := atomicWriteWithBackup(sr.Path, []byte(newYAML)); err != nil {
		w.WriteHeader(500)
		_, _ = w.Write([]byte(err.Error()))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"saved": true, "yaml": newYAML})
}

func atomicWriteWithBackup(path string, data []byte) error {
	// backup
	if _, err := os.Stat(path); err == nil {
		ts := time.Now().Format("20060102-150405")
		_ = os.WriteFile(path+".bak"+ts, mustRead(path), 0644)
	}
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	tmp := filepath.Join(dir, "."+base+".tmp")
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

type envCheckReq struct {
	Names []string `json:"names"`
}
type envCheckResp struct {
	Present map[string]bool `json:"present"`
}

func (s *server) handleEditorEnvCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var req envCheckReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		return
	}
	out := make(map[string]bool, len(req.Names))
	for _, n := range req.Names {
		if n == "" {
			continue
		}
		_, ok := os.LookupEnv(n)
		out[n] = ok
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(envCheckResp{Present: out})
}

type testRunReq struct {
	Parsed      interface{}       `json:"parsed"`
	TestIdx     int               `json:"testIndex"`
	Env         map[string]string `json:"env"`
	RunAll      bool              `json:"runAll,omitempty"`
	IncludeDeps bool              `json:"includeDeps,omitempty"`
}
type testRunResp struct {
	Name       string              `json:"name"`
	Status     string              `json:"status"`
	DurationMs int64               `json:"durationMs"`
	Messages   []string            `json:"messages"`
	Cases      []runner.TestResult `json:"cases,omitempty"`
}

// --- Hook run support ---
type hookRunReq struct {
	Parsed  interface{}       `json:"parsed"`
	Scope   string            `json:"scope"` // suitePre|suitePost|testPre|testPost
	TestIdx int               `json:"testIndex,omitempty"`
	Hook    models.Hook       `json:"hook"`
	Env     map[string]string `json:"env"`
}
type hookRunResp struct {
	Name       string            `json:"name"`
	Status     string            `json:"status"`
	DurationMs int64             `json:"durationMs"`
	Messages   []string          `json:"messages"`
	Vars       map[string]string `json:"vars"`
}

// simple interpolator: ${VAR} from vars, ${ENV:NAME} from environment
func interpolateLite(s string, vars map[string]string) string {
	if s == "" {
		return s
	}
	out := s
	// ${ENV:NAME}
	for {
		i := strings.Index(out, "${ENV:")
		if i < 0 {
			break
		}
		j := strings.Index(out[i:], "}")
		if j < 0 {
			break
		}
		key := out[i+6 : i+j]
		repl := os.Getenv(key)
		out = out[:i] + repl + out[i+j+1:]
	}
	// ${VAR}
	for {
		i := strings.Index(out, "${")
		if i < 0 {
			break
		}
		j := strings.Index(out[i:], "}")
		if j < 0 {
			break
		}
		key := out[i+2 : i+j]
		if strings.HasPrefix(key, "ENV:") { // already handled
			out = out[:i] + out[i+j+1:]
			continue
		}
		repl := vars[key]
		out = out[:i] + repl + out[i+j+1:]
	}
	return out
}

func (s *server) handleEditorHookRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var hr hookRunReq
	if err := json.NewDecoder(r.Body).Decode(&hr); err != nil {
		w.WriteHeader(400)
		return
	}
	// coerce suite
	var suite models.Suite
	bjson, err := json.Marshal(hr.Parsed)
	if err != nil {
		w.WriteHeader(400)
		return
	}
	if err := json.Unmarshal(bjson, &suite); err != nil {
		w.WriteHeader(400)
		return
	}
	// prepare vars
	vars := map[string]string{}
	for k, v := range suite.Variables {
		vars[k] = v
	}
	if strings.HasPrefix(hr.Scope, "test") && hr.TestIdx >= 0 && hr.TestIdx < len(suite.Tests) {
		for k, v := range suite.Tests[hr.TestIdx].Vars {
			vars[k] = v
		}
	}
	// merge hook vars with interpolation
	for k, v := range hr.Hook.Vars {
		vars[k] = interpolateLite(v, vars)
	}
	messages := []string{}
	status := "passed"
	durMs := int64(0)
	// Run SQL part if present
	if hr.Hook.SQL != nil {
		drv := interpolateLite(hr.Hook.SQL.Driver, vars)
		dsn := interpolateLite(hr.Hook.SQL.DSN, vars)
		q := interpolateLite(hr.Hook.SQL.Query, vars)
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		db, e := sql.Open(drv, dsn)
		if e != nil {
			status = "failed"
			messages = append(messages, e.Error())
			goto RESP
		}
		defer db.Close()
		rows, qerr := db.QueryContext(ctx, q)
		if qerr != nil {
			if _, e2 := db.ExecContext(ctx, q); e2 != nil {
				status = "failed"
				messages = append(messages, e2.Error())
				goto RESP
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
						switch vv := vals[i].(type) {
						case []byte:
							m[c] = string(vv)
						case nil:
							m[c] = ""
						default:
							m[c] = fmt.Sprintf("%v", vv)
						}
					}
					for varName, col := range hr.Hook.SQL.Extract {
						vars[varName] = m[col]
					}
				}
			}
		}
		messages = append(messages, "SQL executed")
	}
	// Run HTTP/assert/extract as a test if present
	if hr.Hook.Request != nil {
		temp := suite
		temp.Variables = vars
		temp.Tests = []models.TestCase{{Name: "hook: " + hr.Hook.Name, Request: *hr.Hook.Request, Assert: hr.Hook.Assert, Extract: hr.Hook.Extract}}
		var captured runner.TestResult
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
		defer cancel()
		sum, _ := runner.RunSuite(ctx, &temp, runner.Options{Workers: 1, OnResult: func(tr runner.TestResult) { captured = tr }})
		if captured.Status != "" {
			status = captured.Status
		}
		if status == "passed" && sum.Failed > 0 {
			status = "failed"
		}
		durMs = captured.DurationMs
		if durMs == 0 {
			durMs = sum.Duration.Milliseconds()
		}
		if len(captured.Messages) > 0 {
			messages = append(messages, captured.Messages...)
		}
	}
RESP:
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(hookRunResp{Name: hr.Hook.Name, Status: status, DurationMs: durMs, Messages: messages, Vars: vars})
}

func (s *server) handleEditorTestRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var tr testRunReq
	if err := json.NewDecoder(r.Body).Decode(&tr); err != nil {
		w.WriteHeader(400)
		return
	}
	// coerce parsed to models.Suite
	var suite models.Suite
	bjson, err := json.Marshal(tr.Parsed)
	if err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("bad payload"))
		return
	}
	if err := json.Unmarshal(bjson, &suite); err != nil {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("bad suite model"))
		return
	}
	// Build a temporary suite: either a single test (optionally with dependencies) or the whole suite (value type)
	single := suite
	if !tr.RunAll {
		if tr.TestIdx < 0 || tr.TestIdx >= len(suite.Tests) {
			w.WriteHeader(400)
			_, _ = w.Write([]byte("invalid test index"))
			return
		}
		// If IncludeDeps=true, take the transitive closure of dependsOn for the selected test
		if tr.IncludeDeps {
			// Build name -> test map first
			byName := map[string]models.TestCase{}
			for _, t := range suite.Tests {
				byName[t.Name] = t
			}
			// Collect names recursively
			target := suite.Tests[tr.TestIdx].Name
			need := map[string]struct{}{target: {}}
			var stack []string
			stack = append(stack, target)
			for len(stack) > 0 {
				n := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				t, ok := byName[n]
				if !ok {
					continue
				}
				for _, dep := range t.DependsOn {
					if _, ok := need[dep]; !ok {
						need[dep] = struct{}{}
						stack = append(stack, dep)
					}
				}
			}
			// Preserve original order but filter to only needed tests
			filtered := make([]models.TestCase, 0, len(need))
			for _, t := range suite.Tests {
				if _, ok := need[t.Name]; ok {
					filtered = append(filtered, t)
				}
			}
			singleCopy := suite
			singleCopy.Tests = filtered
			single = singleCopy
		} else {
			singleCopy := suite
			singleCopy.Tests = []models.TestCase{suite.Tests[tr.TestIdx]}
			single = singleCopy
		}
	}
	// run with one worker and isolated context; capture messages via OnResult
	var captured runner.TestResult
	var allResults []runner.TestResult
	runWith := func() (runner.Summary, error) {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		return runner.RunSuite(ctx, &single, runner.Options{Workers: 1, OnResult: func(tr runner.TestResult) { captured = tr; allResults = append(allResults, tr) }})
	}
	var sum runner.Summary
	var runErr error
	if len(tr.Env) > 0 {
		s.envMu.Lock()
		sum, runErr = withEnv(tr.Env, runWith)
		s.envMu.Unlock()
	} else {
		sum, runErr = runWith()
	}
	// Expect exactly one test result in summary details; if runner doesn't expose details, infer from summary
	// For now, synthesize from summary counts; Messages not available without changing runner API, so leave empty unless failures exist.
	var resp testRunResp
	if tr.RunAll {
		// Aggregate for full suite
		name := suite.Name
		if name == "" {
			name = "suite"
		}
		status := "passed"
		if sum.Failed > 0 {
			status = "failed"
		} else if sum.Skipped > 0 {
			status = "skipped"
		}
		var msgs []string
		if runErr != nil {
			if errors.Is(runErr, runner.ErrSuiteNotRunnable) {
				status = "failed"
			}
			msgs = append(msgs, runErr.Error())
		}
		for _, r := range allResults {
			prefix := "✓"
			if r.Status == "failed" {
				prefix = "✗"
			} else if r.Status == "skipped" {
				prefix = "-"
			}
			msgs = append(msgs, fmt.Sprintf("%s %s (%d ms)", prefix, r.Name, r.DurationMs))
			if len(r.Messages) > 0 {
				msgs = append(msgs, r.Messages...)
			}
		}
		resp = testRunResp{Name: name, Status: status, DurationMs: sum.Duration.Milliseconds(), Messages: msgs, Cases: allResults}
	} else {
		// Single test result
		status := captured.Status
		if status == "" {
			if sum.Failed > 0 {
				status = "failed"
			} else if sum.Skipped > 0 {
				status = "skipped"
			} else {
				status = "passed"
			}
		}
		name := suite.Tests[tr.TestIdx].Name
		msgs := captured.Messages
		if runErr != nil {
			if errors.Is(runErr, runner.ErrSuiteNotRunnable) {
				status = "failed"
			}
			msgs = append([]string{runErr.Error()}, msgs...)
		}
		if msgs == nil {
			msgs = []string{}
		}
		dur := captured.DurationMs
		if dur == 0 {
			dur = sum.Duration.Milliseconds()
		}
		resp = testRunResp{Name: name, Status: status, DurationMs: dur, Messages: msgs}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func mustRead(p string) []byte { b, _ := os.ReadFile(p); return b }

type runReq struct {
	Suites  []string          `json:"suites"`
	Workers int               `json:"workers"`
	Env     map[string]string `json:"env"`
}
type runResp struct {
	RunID string `json:"runId"`
}

func (s *server) handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var req runReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		return
	}
	if len(req.Suites) == 0 {
		w.WriteHeader(400)
		return
	}
	id := fmt.Sprintf("run-%d", time.Now().UnixNano())
	ch := make(chan string, 256)
	rd := make(chan struct{})
	s.mu.Lock()
	s.streams[id] = ch
	s.ready[id] = rd
	s.mu.Unlock()
	go s.runSuites(id, req.Suites, req.Workers, req.Env)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(runResp{RunID: id})
}

func (s *server) handleStream(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("runId")
	if id == "" {
		w.WriteHeader(400)
		return
	}
	s.mu.Lock()
	ch, ok := s.streams[id]
	rd, ok2 := s.ready[id]
	if ok2 {
		close(rd)
		delete(s.ready, id)
	}
	s.mu.Unlock()
	if !ok {
		w.WriteHeader(404)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	fl, _ := w.(http.Flusher)
	notify := r.Context().Done()
	for {
		select {
		case <-notify:
			return
		case msg, open := <-ch:
			if !open {
				return
			}
			fmt.Fprintf(w, "data: %s\n\n", msg)
			if fl != nil {
				fl.Flush()
			}
		}
	}
}

func (s *server) handleCancel(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("runId")
	if id == "" {
		w.WriteHeader(400)
		return
	}
	s.mu.Lock()
	cancel, ok := s.runs[id]
	s.mu.Unlock()
	if !ok {
		w.WriteHeader(404)
		return
	}
	cancel()
	w.WriteHeader(204)
}

func (s *server) runSuites(id string, suites []string, workers int, env map[string]string) {
	out := func(ev any) {
		b, _ := json.Marshal(ev)
		s.mu.Lock()
		ch := s.streams[id]
		s.mu.Unlock()
		select {
		case ch <- string(b):
		default:
		}
	}
	type evt struct {
		Type    string `json:"type"`
		Payload any    `json:"payload"`
	}
	// wait for at least one SSE subscriber or a short timeout to reduce race for early events
	s.mu.Lock()
	rd, ok := s.ready[id]
	s.mu.Unlock()
	if ok {
		select {
		case <-rd:
		case <-time.After(500 * time.Millisecond):
		}
	}
	out(evt{Type: "batchStart", Payload: map[string]any{"total": len(suites)}})
	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.runs[id] = cancel
	s.mu.Unlock()
Loop:
	for _, path := range suites {
		select {
		case <-ctx.Done():
			break Loop
		default:
		}
		s.runOneWithCtx(ctx, path, workers, env, out)
	}
	out(evt{Type: "batchEnd"})
	out(evt{Type: "done"})
	s.mu.Lock()
	close(s.streams[id])
	delete(s.streams, id)
	delete(s.runs, id)
	s.mu.Unlock()
}

func (s *server) runOneWithCtx(ctx context.Context, path string, workers int, env map[string]string, out func(any)) {
	type evt struct {
		Type    string `json:"type"`
		Payload any    `json:"payload"`
	}
	// suppress CLI prints during GUI run
	prev := ui.Enabled
	ui.Enabled = false
	defer func() { ui.Enabled = prev }()
	ctx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	defer cancel()
	suite, err := runner.LoadSuite(path)
	if err != nil {
		out(evt{Type: "error", Payload: map[string]any{"path": path, "error": err.Error()}})
		return
	}
	// compute totals and stage counts from loaded suite
	stageCounts := map[int]int{}
	total := 0
	// determine if any test has Only=true
	only := false
	for _, tc := range suite.Tests {
		if tc.Only {
			only = true
			break
		}
	}
	// include tests respecting skip/only and matrix expansion counts
	for _, tc := range suite.Tests {
		if only && !tc.Only {
			continue
		}
		if tc.Skip {
			continue
		}
		// matrix combos count (product of lengths)
		combos := 1
		if len(tc.Matrix) > 0 {
			for _, vals := range tc.Matrix {
				if len(vals) > 0 {
					combos *= len(vals)
				}
			}
		}
		total += combos
		stageCounts[tc.Stage] = stageCounts[tc.Stage] + combos
	}
	out(evt{Type: "suiteStart", Payload: map[string]any{"path": path, "name": suite.Name, "total": total, "stages": stageCounts}})
	runWithSuite := func() (runner.Summary, error) {
		return runner.RunSuite(ctx, suite, runner.Options{Workers: workers, OnStart: func(tr runner.TestResult) {
			out(evt{Type: "testStart", Payload: tr})
		}, OnResult: func(tr runner.TestResult) {
			out(evt{Type: "test", Payload: tr})
		}})
	}
	var sum runner.Summary
	var runErr error
	if len(env) > 0 {
		// serialize env overrides to avoid races
		s.envMu.Lock()
		sum, runErr = withEnv(env, runWithSuite)
		s.envMu.Unlock()
	} else {
		sum, runErr = runWithSuite()
	}
	// Note: runner returns an error when tests fail; we surface that via suiteEnd summary only.
	if runErr != nil {
		out(evt{Type: "error", Payload: map[string]any{"path": path, "error": runErr.Error()}})
	}
	out(evt{Type: "suiteEnd", Payload: map[string]any{
		"path": path,
		"name": suite.Name,
		"summary": map[string]any{
			"total":      sum.Total,
			"passed":     sum.Passed,
			"failed":     sum.Failed,
			"skipped":    sum.Skipped,
			"durationMs": sum.Duration.Milliseconds(),
		},
	}})
}

type totals struct {
	Total  int         `json:"total"`
	Stages map[int]int `json:"stages"`
}

func findTotals(path string) totals {
	t := totals{Stages: map[int]int{}}
	if s, err := runner.LoadSuite(path); err == nil {
		only := false
		for _, tc := range s.Tests {
			if tc.Only {
				only = true
				break
			}
		}
		for _, tc := range s.Tests {
			if only && !tc.Only {
				continue
			}
			if tc.Skip {
				continue
			}
			combos := 1
			if len(tc.Matrix) > 0 {
				for _, vals := range tc.Matrix {
					if len(vals) > 0 {
						combos *= len(vals)
					}
				}
			}
			t.Total += combos
			t.Stages[tc.Stage] = t.Stages[tc.Stage] + combos
		}
	}
	return t
}

func findSuites() []string {
	seen := map[string]struct{}{}
	var found []string
	filepath.Walk("testdata", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml") {
			if _, ok := seen[path]; !ok {
				seen[path] = struct{}{}
				found = append(found, path)
			}
		}
		return nil
	})
	sort.Strings(found)
	return found
}

func tryOpen(url string) {
	cmds := [][]string{{"xdg-open", url}, {"open", url}, {"cmd", "/c", "start", url}}
	for _, c := range cmds {
		if _, err := execLookPath(c[0]); err == nil {
			// best effort
			_ = spawn(c[0], c[1:]...)
			return
		}
	}
}

func execLookPath(bin string) (string, error) { return exec.LookPath(bin) }

func spawn(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	return cmd.Start()
}

// withEnv temporarily applies env overrides while executing fn, then restores previous values.
func withEnv[T any](env map[string]string, fn func() (T, error)) (T, error) {
	type prev struct {
		val     string
		existed bool
	}
	prevs := make(map[string]prev)
	for k, v := range env {
		old, ok := os.LookupEnv(k)
		prevs[k] = prev{val: old, existed: ok}
		_ = os.Setenv(k, v)
	}
	// ensure restore regardless of outcome
	defer func() {
		for k, p := range prevs {
			if p.existed {
				_ = os.Setenv(k, p.val)
			} else {
				_ = os.Unsetenv(k)
			}
		}
	}()
	return fn()
}
