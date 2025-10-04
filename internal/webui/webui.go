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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/DrWeltschmerz/HydReq/internal/adapters/bruno"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/har"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/insomnia"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/newman"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/oapi"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/postman"
	"github.com/DrWeltschmerz/HydReq/internal/adapters/restclient"
	"github.com/DrWeltschmerz/HydReq/internal/report"
	"github.com/DrWeltschmerz/HydReq/internal/runner"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
	valfmt "github.com/DrWeltschmerz/HydReq/internal/validate"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
	"github.com/getkin/kin-openapi/openapi3"
	routers "github.com/getkin/kin-openapi/routers"
	legacy "github.com/getkin/kin-openapi/routers/legacy"
	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"
	"gopkg.in/yaml.v3"
	kyaml "sigs.k8s.io/yaml"
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
	schema  *jsonschema.Schema
	// reports stores generated reports keyed by runId and suite path
	reports map[string]map[string]any
	// inlineSuites stores, per runId, an optional map of path -> in-memory Suite to run instead of loading from disk
	inlineSuites map[string]map[string]*models.Suite
}

func Run(addr string, openBrowser bool) error {
	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}}
	// Compile JSON Schema once if present so the UI validator matches CLI validator
	if _, err := os.Stat("schemas/suite.schema.json"); err == nil {
		if abs, aerr := filepath.Abs("schemas/suite.schema.json"); aerr == nil {
			if sch, cerr := jsonschema.Compile(valfmt.PathToFileURL(abs)); cerr == nil {
				s.schema = sch
			} else {
				log.Printf("schema compile error: %v", cerr)
			}
		}
	}
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
	// Path safety/existence check used by UI when creating files
	s.mux.HandleFunc("/api/editor/checkpath", s.handleEditorCheckPath)
	s.mux.HandleFunc("/api/editor/validate", s.handleEditorValidate)
	s.mux.HandleFunc("/api/editor/save", s.handleEditorSave)
	// Editor quick-run for a single test (in-memory)
	s.mux.HandleFunc("/api/editor/testrun", s.handleEditorTestRun)
	// Env check for auth UX
	s.mux.HandleFunc("/api/editor/envcheck", s.handleEditorEnvCheck)
	// Run a single hook (suite/test; pre/post)
	s.mux.HandleFunc("/api/editor/hookrun", s.handleEditorHookRun)
	// Import collection endpoint
	s.mux.HandleFunc("/api/import", s.handleImport)
	// Optional: serve .env for UI preload (dev only; guard with HYDREQ_ENV_UI=1)
	s.mux.HandleFunc("/api/env", s.handleEnvFile)
	// report download endpoints
	s.mux.HandleFunc("/api/report/run", s.handleReportRun)
	s.mux.HandleFunc("/api/report/suite", s.handleReportSuite)
	// Serve static UI: Prefer on-disk files in development when HYDREQ_UI_DEV/HYDREQ_UI_STATIC_DIR is set,
	// otherwise fall back to embedded assets via go:embed.
	if os.Getenv("HYDREQ_UI_DEV") == "1" || strings.EqualFold(os.Getenv("HYDREQ_UI_DEV"), "true") || os.Getenv("HYDREQ_UI_STATIC_DIR") != "" {
		dir := strings.TrimSpace(os.Getenv("HYDREQ_UI_STATIC_DIR"))
		if dir == "" {
			// default path to the static directory relative to repo
			dir = filepath.Join("internal", "webui", "static")
		}
		// normalize to absolute to aid debugging
		if abs, err := filepath.Abs(dir); err == nil {
			dir = abs
		}
		log.Printf("HydReq GUI: serving static files from disk (dev mode): %s", dir)
		fsHandler := http.FileServer(http.Dir(dir))
		s.mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			// favicon: try to serve if present; otherwise 204 to prevent noisy 404s
			if r.URL.Path == "/favicon.ico" {
				fav := filepath.Join(dir, "favicon.ico")
				if _, err := os.Stat(fav); err == nil {
					w.Header().Set("Content-Type", "image/x-icon")
					http.ServeFile(w, r, fav)
				} else {
					w.WriteHeader(http.StatusNoContent)
				}
				return
			}
			if r.URL.Path == "/" || r.URL.Path == "" {
				// Serve index.html directly to avoid FileServer directory redirects
				idx := filepath.Join(dir, "index.html")
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				http.ServeFile(w, r, idx)
				return
			}
			// MIME hints for some CDNs/clients that ignore extension -> type
			if strings.HasSuffix(r.URL.Path, ".js") {
				w.Header().Set("Content-Type", "application/javascript")
			} else if strings.HasSuffix(r.URL.Path, ".css") {
				w.Header().Set("Content-Type", "text/css")
			}
			fsHandler.ServeHTTP(w, r)
		}))
	} else {
		// Serve the embedded static/ directory at the root so / loads index.html directly
		// Serve embedded static files with no-cache headers to prevent stale UI during local dev
		if sub, err := fs.Sub(staticFS, "static"); err == nil {
			fsHandler := http.FileServer(http.FS(sub))
			s.mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				w.Header().Set("Pragma", "no-cache")
				w.Header().Set("Expires", "0")
				if r.URL.Path == "/favicon.ico" {
					// best-effort serve embedded favicon if present
					if b, err := fs.ReadFile(sub, "favicon.ico"); err == nil {
						w.Header().Set("Content-Type", "image/x-icon")
						w.Write(b)
					} else {
						w.WriteHeader(http.StatusNoContent)
					}
					return
				}
				if r.URL.Path == "/" || r.URL.Path == "" {
					// Serve embedded index.html explicitly to avoid redirect quirks
					if b, err := fs.ReadFile(sub, "index.html"); err == nil {
						w.Header().Set("Content-Type", "text/html; charset=utf-8")
						w.Write(b)
						return
					}
				}
				// Set correct MIME types for JavaScript and CSS files
				if strings.HasSuffix(r.URL.Path, ".js") {
					w.Header().Set("Content-Type", "application/javascript")
				} else if strings.HasSuffix(r.URL.Path, ".css") {
					w.Header().Set("Content-Type", "text/css")
				}
				fsHandler.ServeHTTP(w, r)
			}))
		} else {
			fsHandler := http.FileServer(http.FS(staticFS))
			s.mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				w.Header().Set("Pragma", "no-cache")
				w.Header().Set("Expires", "0")
				if r.URL.Path == "/favicon.ico" {
					w.WriteHeader(http.StatusNoContent)
					return
				}
				if r.URL.Path == "/" || r.URL.Path == "" {
					if b, err := fs.ReadFile(staticFS, "static/index.html"); err == nil {
						w.Header().Set("Content-Type", "text/html; charset=utf-8")
						w.Write(b)
						return
					}
				}
				// Set correct MIME types for JavaScript and CSS files
				if strings.HasSuffix(r.URL.Path, ".js") {
					w.Header().Set("Content-Type", "application/javascript")
				} else if strings.HasSuffix(r.URL.Path, ".css") {
					w.Header().Set("Content-Type", "text/css")
				}
				fsHandler.ServeHTTP(w, r)
			}))
		}
	}
}

// handleEnvFile serves the contents of a .env file for UI preloading of env overrides.
// Disabled by default; enable by setting HYDREQ_ENV_UI=1. Looks in working dir and bin/.env.
func (s *server) handleEnvFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(405)
		return
	}
	if os.Getenv("HYDREQ_ENV_UI") != "1" {
		// Not enabled; pretend not found so we don't leak env accidentally
		w.WriteHeader(404)
		return
	}
	cands := []string{".env", filepath.Join("bin", ".env")}
	for _, p := range cands {
		if b, err := os.ReadFile(p); err == nil {
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.Write(b)
			return
		}
	}
	w.WriteHeader(404)
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
		Path string   `json:"path"`
		Name string   `json:"name,omitempty"`
		Tags []string `json:"tags,omitempty"`
	}
	out := make([]item, 0, len(list))
	for _, p := range list {
		item := item{Path: p}
		// Try to load suite to get the name and tags
		if suite, err := runner.LoadSuite(p); err == nil {
			if suite.Name != "" {
				item.Name = suite.Name
			}
			// derive suite-level tags from union of test tags
			if len(suite.Tests) > 0 {
				set := map[string]struct{}{}
				for _, tc := range suite.Tests {
					for _, tg := range tc.Tags {
						if tg == "" {
							continue
						}
						set[tg] = struct{}{}
					}
				}
				if len(set) > 0 {
					item.Tags = make([]string, 0, len(set))
					for k := range set {
						item.Tags = append(item.Tags, k)
					}
					sort.Strings(item.Tags)
				}
			}
		}
		out = append(out, item)
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
	case http.MethodDelete:
		// Delete a suite file at the provided path. Restricted to testdata/*.yml/.yaml
		path := r.URL.Query().Get("path")
		if !isEditablePath(path) {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("invalid path"))
			return
		}
		if _, err := os.Stat(path); err != nil {
			if os.IsNotExist(err) {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			log.Printf("delete suite stat error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("unable to access file"))
			return
		}
		if err := os.Remove(path); err != nil {
			log.Printf("delete suite remove error: %v", err)
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("failed to delete"))
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		w.WriteHeader(405)
	}
}

type checkPathReq struct {
	Path string `json:"path"`
}
type checkPathResp struct {
	Safe   bool `json:"safe"`
	Exists bool `json:"exists"`
}

func (s *server) handleEditorCheckPath(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(405)
		return
	}
	var req checkPathReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(400)
		return
	}
	safe := isEditablePath(req.Path)
	exists := false
	if safe {
		if _, err := os.Stat(req.Path); err == nil {
			exists = true
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(checkPathResp{Safe: safe, Exists: exists})
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
			// Schema validation (matches CLI): YAML -> JSON -> interface{} -> Validate
			if s.schema != nil {
				if jsonBytes, jerr := kyaml.YAMLToJSON([]byte(raw)); jerr == nil {
					var v any
					if jerr2 := json.Unmarshal(jsonBytes, &v); jerr2 == nil {
						if verr := s.schema.Validate(v); verr != nil {
							msg := valfmt.FormatValidationError([]byte(raw), verr)
							issues = append(issues, map[string]any{"path": "schema", "message": msg, "severity": "error"})
						}
					}
				}
			}
		}
	} else if vr.Parsed != nil {
		// re-marshal+unmarshal to models.Suite
		if b, err := json.Marshal(vr.Parsed); err == nil {
			if err := json.Unmarshal(b, &parsed); err != nil {
				issues = append(issues, map[string]any{"path": "root", "message": err.Error(), "severity": "error"})
			} else {
				parsedValid = true
				// If we only have parsed, validate the canonical YAML serialization against schema
				if s.schema != nil {
					var buf strings.Builder
					enc := yaml.NewEncoder(&buf)
					enc.SetIndent(2)
					_ = enc.Encode(&parsed)
					_ = enc.Close()
					yamlText := buf.String()
					if jsonBytes, jerr := kyaml.YAMLToJSON([]byte(yamlText)); jerr == nil {
						var v any
						if jerr2 := json.Unmarshal(jsonBytes, &v); jerr2 == nil {
							if verr := s.schema.Validate(v); verr != nil {
								msg := valfmt.FormatValidationError([]byte(yamlText), verr)
								issues = append(issues, map[string]any{"path": "schema", "message": msg, "severity": "error"})
							}
						}
					}
				}
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
			isEnvName := func(v string) bool {
				if strings.TrimSpace(v) == "" {
					return false
				}
				re := regexp.MustCompile(`^[A-Z_][A-Z0-9_]*$`)
				return re.MatchString(v)
			}
			if strings.TrimSpace(parsed.Auth.BearerEnv) != "" {
				be := strings.TrimSpace(parsed.Auth.BearerEnv)
				if isEnvName(be) {
					if _, ok := os.LookupEnv(be); !ok {
						issues = append(issues, map[string]any{"path": "auth.bearerEnv", "message": "environment variable not set: " + be, "severity": "info"})
					}
				}
			}
			if strings.TrimSpace(parsed.Auth.BasicEnv) != "" {
				ba := strings.TrimSpace(parsed.Auth.BasicEnv)
				if isEnvName(ba) {
					if _, ok := os.LookupEnv(ba); !ok {
						issues = append(issues, map[string]any{"path": "auth.basicEnv", "message": "environment variable not set: " + ba, "severity": "info"})
					}
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
	// ensure parent directory exists (tests/CI may write into testdata/ which might not exist)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
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
	Parsed            interface{}       `json:"parsed"`
	TestIdx           int               `json:"testIndex"`
	Env               map[string]string `json:"env"`
	RunAll            bool              `json:"runAll,omitempty"`
	IncludeDeps       bool              `json:"includeDeps,omitempty"`
	IncludePrevStages bool              `json:"includePrevStages,omitempty"`
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
	// Run JS hook if present
	if hr.Hook.JS != nil {
		start := time.Now()
		err := runner.RunJSHook(hr.Hook.JS, &vars)
		durMs = time.Since(start).Milliseconds()
		if err != nil {
			status = "failed"
			messages = append(messages, err.Error())
		} else {
			messages = append(messages, "JS executed successfully")
		}
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
	// Build a temporary suite: either a single test (optionally with dependencies and/or previous stages) or the whole suite (value type)
	single := suite
	if !tr.RunAll {
		if tr.TestIdx < 0 || tr.TestIdx >= len(suite.Tests) {
			w.WriteHeader(400)
			_, _ = w.Write([]byte("invalid test index"))
			return
		}
		// Compose test list based on flags:
		// - IncludeDeps: closure of dependsOn for the selected test
		// - IncludePrevStages: all tests with Stage < selected.Stage
		// If neither flag set, run only selected test
		target := suite.Tests[tr.TestIdx]
		needNames := map[string]struct{}{}
		includeAny := false
		if tr.IncludeDeps {
			includeAny = true
			byName := map[string]models.TestCase{}
			for _, t := range suite.Tests {
				byName[t.Name] = t
			}
			stack := []string{target.Name}
			needNames[target.Name] = struct{}{}
			for len(stack) > 0 {
				n := stack[len(stack)-1]
				stack = stack[:len(stack)-1]
				t, ok := byName[n]
				if !ok {
					continue
				}
				for _, dep := range t.DependsOn {
					if _, ok := needNames[dep]; !ok {
						needNames[dep] = struct{}{}
						stack = append(stack, dep)
					}
				}
			}
		}
		if tr.IncludePrevStages {
			includeAny = true
			ts := target.Stage
			for i := 0; i < len(suite.Tests); i++ {
				t := suite.Tests[i]
				if t.Stage < ts {
					needNames[t.Name] = struct{}{}
				}
			}
			// also ensure target included
			needNames[target.Name] = struct{}{}
		}
		singleCopy := suite
		if includeAny {
			// preserve original order but filter to only needed tests
			filtered := make([]models.TestCase, 0, len(needNames))
			for _, t := range suite.Tests {
				if _, ok := needNames[t.Name]; ok {
					filtered = append(filtered, t)
				}
			}
			singleCopy.Tests = filtered
		} else {
			singleCopy.Tests = []models.TestCase{target}
		}
		single = singleCopy
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
		// Single test run request (may include deps and/or previous stages)
		// If multiple tests executed, return per-case results too so UI can show all outputs
		multi := (tr.IncludeDeps || tr.IncludePrevStages) && len(allResults) > 1
		// Derive overall status from summary if multiple, otherwise from captured
		status := captured.Status
		if status == "" || multi {
			if sum.Failed > 0 {
				status = "failed"
			} else if sum.Skipped > 0 {
				status = "skipped"
			} else {
				status = "passed"
			}
		}
		name := suite.Tests[tr.TestIdx].Name
		// Build messages: for multi, list each test line and details; otherwise keep captured
		var msgs []string
		if multi {
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
		} else {
			msgs = captured.Messages
		}
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
		if multi || dur == 0 {
			dur = sum.Duration.Milliseconds()
		}
		resp = testRunResp{Name: name, Status: status, DurationMs: dur, Messages: msgs}
		if multi {
			resp.Cases = allResults
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// handleEditorStreamRun starts an in-memory run (single test or full suite) and streams via /api/stream using returned runId
// (removed) handleEditorStreamRun: we reuse /api/run for streaming suite runs

func mustRead(p string) []byte { b, _ := os.ReadFile(p); return b }

type runReq struct {
	Suites         []string          `json:"suites"`
	Workers        int               `json:"workers"`
	Env            map[string]string `json:"env"`
	Tags           []string          `json:"tags"`
	DefaultTimeout int               `json:"defaultTimeout"`
	// Optional: provide in-memory suites to run under specific paths; when present, server uses these instead of reading from disk.
	InlineSuites map[string]any `json:"inlineSuites,omitempty"`
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
	// capture inlineSuites for this runId if provided
	if req.InlineSuites != nil {
		if s.inlineSuites == nil {
			s.inlineSuites = map[string]map[string]*models.Suite{}
		}
		m := make(map[string]*models.Suite)
		for k, v := range req.InlineSuites {
			// coerce v into models.Suite
			var suite models.Suite
			// try direct map->json->struct
			if b, err := json.Marshal(v); err == nil {
				if err2 := json.Unmarshal(b, &suite); err2 == nil {
					sc := suite
					m[k] = &sc
				}
			}
		}
		if len(m) > 0 {
			s.inlineSuites[id] = m
		}
	}
	s.mu.Unlock()
	go s.runSuites(id, req.Suites, req.Workers, req.Env, req.Tags, req.DefaultTimeout)
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

func (s *server) handleImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(32 << 20) // 32MB max
	if err != nil {
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	format := r.FormValue("format")
	if format == "" {
		http.Error(w, "No format specified", http.StatusBadRequest)
		return
	}

	// Convert based on format
	var suite *models.Suite
	switch format {
	case "postman":
		suite, err = postman.Convert(file, nil)
	case "insomnia":
		suite, err = insomnia.Convert(file)
	case "har":
		suite, err = har.Convert(file)
	case "openapi":
		suite, err = oapi.Convert(file)
	case "bruno":
		suite, err = bruno.Convert(file)
	case "restclient":
		suite, err = restclient.Convert(file)
	case "newman":
		suite, err = newman.Convert(file, nil)
	default:
		http.Error(w, "Unsupported format: "+format, http.StatusBadRequest)
		return
	}

	if err != nil {
		http.Error(w, "Conversion failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Marshal to YAML
	yamlData, err := yaml.Marshal(suite)
	if err != nil {
		http.Error(w, "Failed to marshal YAML: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "application/x-yaml")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+strings.TrimSuffix(header.Filename, filepath.Ext(header.Filename))+"_imported.yaml\"")

	// Write YAML data
	w.Write(yamlData)
}

// handleReportRun streams a run-level report (batch) in either json|junit|html
func (s *server) handleReportRun(w http.ResponseWriter, r *http.Request) {
	runId := r.URL.Query().Get("runId")
	if runId == "" {
		http.Error(w, "runId required", 400)
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}
	s.mu.Lock()
	repmap, ok := s.reports[runId]
	s.mu.Unlock()
	if !ok {
		// fallback: serve on-disk report files if CLI produced them
		reportDir := "reports"
		switch format {
		case "html":
			p := filepath.Join(reportDir, runId+".html")
			if _, err := os.Stat(p); err == nil {
				w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(p))
				http.ServeFile(w, r, p)
				return
			}
		case "json":
			p := filepath.Join(reportDir, runId+".json")
			if _, err := os.Stat(p); err == nil {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(p))
				http.ServeFile(w, r, p)
				return
			}
		case "junit":
			p := filepath.Join(reportDir, runId+".xml")
			if _, err := os.Stat(p); err == nil {
				w.Header().Set("Content-Type", "application/xml")
				w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(p))
				http.ServeFile(w, r, p)
				return
			}
		}
		// try generic extensions
		for _, ext := range []string{".html", ".json", ".xml"} {
			p := filepath.Join("reports", runId+ext)
			if _, err := os.Stat(p); err == nil {
				http.ServeFile(w, r, p)
				return
			}
		}
		http.Error(w, "report not found", 404)
		return
	}
	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=run-"+runId+".json")
		var br report.BatchReport
		if v, ok := repmap["batch::detailed"]; ok {
			if bb, ok2 := v.(report.BatchReport); ok2 {
				br = bb
			}
		}
		if len(br.Suites) == 0 {
			for k, v := range repmap {
				if strings.HasSuffix(k, "::detailed") {
					if dr, ok := v.(report.DetailedReport); ok {
						br.Suites = append(br.Suites, dr)
					}
				}
			}
			br.RunAt = time.Now()
			var sum report.Summary
			for _, s2 := range br.Suites {
				sum.Total += s2.Summary.Total
				sum.Passed += s2.Summary.Passed
				sum.Failed += s2.Summary.Failed
				sum.Skipped += s2.Summary.Skipped
			}
			br.Summary = sum
		}
		_ = report.WriteJSONBatchTo(w, br)
	case "junit":
		w.Header().Set("Content-Type", "application/xml")
		w.Header().Set("Content-Disposition", "attachment; filename=run-"+runId+".xml")
		var sum report.Summary
		if v, ok := repmap["batch::summary"]; ok {
			if ssum, ok2 := v.(report.Summary); ok2 {
				sum = ssum
			}
		}
		if sum.Total == 0 {
			for _, v := range repmap {
				if dr, ok := v.(report.DetailedReport); ok {
					sum.Total += dr.Summary.Total
					sum.Passed += dr.Summary.Passed
					sum.Failed += dr.Summary.Failed
					sum.Skipped += dr.Summary.Skipped
				}
			}
		}
		_ = report.WriteJUnitBatchSummaryTo(w, sum)
	case "html":
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Content-Disposition", "attachment; filename=run-"+runId+".html")
		var br report.BatchReport
		if v, ok := repmap["batch::detailed"]; ok {
			if bb, ok2 := v.(report.BatchReport); ok2 {
				br = bb
			}
		}
		if len(br.Suites) == 0 {
			for k, v := range repmap {
				if strings.HasSuffix(k, "::detailed") {
					if dr, ok := v.(report.DetailedReport); ok {
						br.Suites = append(br.Suites, dr)
					}
				}
			}
			br.RunAt = time.Now()
			var sum report.Summary
			for _, s2 := range br.Suites {
				sum.Total += s2.Summary.Total
				sum.Passed += s2.Summary.Passed
				sum.Failed += s2.Summary.Failed
				sum.Skipped += s2.Summary.Skipped
			}
			br.Summary = sum
		}
		reportDir := "reports"
		if err := os.MkdirAll(reportDir, 0o755); err != nil {
			http.Error(w, "failed to create reports directory", 500)
			return
		}
		// prefer runTS recorded during run; fallback to runId timestamp parsing
		runTS := ""
		if v, ok := s.reports[runId]["runTS"]; ok {
			if sTS, ok2 := v.(string); ok2 {
				runTS = sTS
			}
		}
		if runTS == "" {
			// fall back to using runId suffix if it looks like run-<ts>
			if strings.HasPrefix(runId, "run-") {
				runTS = strings.TrimPrefix(runId, "run-")
			} else {
				runTS = time.Now().Format("20060102-150405")
			}
		}
		outPath := filepath.Join(reportDir, fmt.Sprintf("run-%s.html", runTS))
		if err := report.WriteHTMLBatch(outPath, br); err != nil {
			http.Error(w, "failed to generate report", 500)
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(outPath))
		http.ServeFile(w, r, outPath)
	default:
		http.Error(w, "unsupported format", 400)
	}
}

// handleReportSuite streams a suite-level report identified by runId & path
func (s *server) handleReportSuite(w http.ResponseWriter, r *http.Request) {
	runId := r.URL.Query().Get("runId")
	path := r.URL.Query().Get("path")
	if runId == "" || path == "" {
		http.Error(w, "runId and path required", 400)
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}
	s.mu.Lock()
	repmap, ok := s.reports[runId]
	s.mu.Unlock()
	if !ok {
		// try on-disk fallbacks
		reportDir := "reports"
		p := filepath.Join(reportDir, runId+".html")
		if _, err := os.Stat(p); err == nil {
			w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(p))
			http.ServeFile(w, r, p)
			return
		}
		baseName := sanitizeFilename(filepath.Base(path))
		// Try common CLI filename patterns: <basename>-<runTS>.html
		matches, _ := filepath.Glob(filepath.Join(reportDir, baseName+"-*.html"))
		if len(matches) > 0 {
			w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(matches[0]))
			http.ServeFile(w, r, matches[0])
			return
		}
		// If runId encodes a run timestamp like run-<ts>, try matching *-<ts>.html
		if strings.HasPrefix(runId, "run-") {
			runTS := strings.TrimPrefix(runId, "run-")
			matches2, _ := filepath.Glob(filepath.Join(reportDir, "*-"+runTS+".html"))
			if len(matches2) > 0 {
				w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(matches2[0]))
				http.ServeFile(w, r, matches2[0])
				return
			}
			// also try combined baseName with runTS in filename
			matches3, _ := filepath.Glob(filepath.Join(reportDir, "*"+baseName+"*"+runTS+"*.html"))
			if len(matches3) > 0 {
				w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(matches3[0]))
				http.ServeFile(w, r, matches3[0])
				return
			}
		}
		http.Error(w, "report not found", 404)
		return
	}
	key := path + "::detailed"
	v, ok := repmap[key]
	if !ok {
		baseName := sanitizeFilename(filepath.Base(path))
		matches, _ := filepath.Glob(filepath.Join("reports", "*"+baseName+"*.html"))
		if len(matches) > 0 {
			http.ServeFile(w, r, matches[0])
			return
		}
		http.Error(w, "suite report not found", 404)
		return
	}
	dr, ok := v.(report.DetailedReport)
	if !ok {
		http.Error(w, "invalid report", 500)
		return
	}
	switch format {
	case "json":
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+sanitizeFilename(dr.Suite)+".json\"")
		_ = report.WriteJSONDetailedTo(w, dr)
	case "junit":
		w.Header().Set("Content-Type", "application/xml")
		w.Header().Set("Content-Disposition", "attachment; filename=\""+sanitizeFilename(dr.Suite)+".xml\"")
		_ = report.WriteJUnitDetailedTo(w, dr.Suite, dr.Summary, dr.TestCases)
	case "html":
		w.Header().Set("Content-Type", "text/html")
		// ensure reports dir exists
		if err := os.MkdirAll("reports", 0o755); err != nil {
			http.Error(w, "failed to create reports directory", 500)
			return
		}
		// Use runTS recorded during the run to match CLI naming (<sanitized>-<runTS>.html)
		runTS := ""
		if v, ok := s.reports[runId]["runTS"]; ok {
			if sTS, ok2 := v.(string); ok2 {
				runTS = sTS
			}
		}
		if runTS == "" {
			runTS = time.Now().Format("20060102-150405")
		}
		outPath := filepath.Join("reports", fmt.Sprintf("%s-%s.html", sanitizeFilename(dr.Suite), runTS))
		if err := report.WriteHTMLDetailed(outPath, dr); err != nil {
			http.Error(w, "failed to generate report", 500)
			return
		}
		w.Header().Set("Content-Disposition", "attachment; filename=\""+filepath.Base(outPath)+"\"")
		http.ServeFile(w, r, outPath)
	default:
		http.Error(w, "unsupported format", 400)
	}
}

func (s *server) runSuites(id string, suites []string, workers int, env map[string]string, tags []string, defaultTimeout int) {
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
	// Wait for at least one SSE subscriber or a short timeout to reduce race for early events.
	// The default grace is 1500ms, overridable via HYDREQ_SSE_READY_WAIT_MS (milliseconds).
	s.mu.Lock()
	rd, ok := s.ready[id]
	s.mu.Unlock()
	if ok {
		waitMs := 1500
		if s := strings.TrimSpace(os.Getenv("HYDREQ_SSE_READY_WAIT_MS")); s != "" {
			if v, err := strconv.Atoi(s); err == nil && v >= 0 {
				waitMs = v
			}
		}
		select {
		case <-rd:
		case <-time.After(time.Duration(waitMs) * time.Millisecond):
		}
	}
	out(evt{Type: "batchStart", Payload: map[string]any{"total": len(suites)}})
	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.runs[id] = cancel
	// initialize report map for this run and record runTS for filename parity with CLI
	if s.reports == nil {
		s.reports = map[string]map[string]any{}
	}
	if s.reports[id] == nil {
		s.reports[id] = map[string]any{}
	}
	runTS := time.Now().Format("20060102-150405")
	s.reports[id]["runTS"] = runTS
	s.mu.Unlock()
Loop:
	for _, path := range suites {
		select {
		case <-ctx.Done():
			break Loop
		default:
		}
		s.runOneWithCtx(id, ctx, path, workers, env, tags, defaultTimeout, out)
	}
	out(evt{Type: "batchEnd"})
	out(evt{Type: "done"})
	s.mu.Lock()
	close(s.streams[id])
	delete(s.streams, id)
	delete(s.runs, id)
	s.mu.Unlock()
}

func (s *server) runOneWithCtx(runId string, ctx context.Context, path string, workers int, env map[string]string, tags []string, defaultTimeout int, out func(any)) {
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
	// Prefer inline in-memory suite if present for this runId and path; else load from disk
	var suite *models.Suite
	var err error
	s.mu.Lock()
	if s.inlineSuites != nil {
		if mm, ok := s.inlineSuites[runId]; ok {
			if inl, ok2 := mm[path]; ok2 && inl != nil {
				// copy to avoid concurrent mutation issues
				cp := *inl
				suite = &cp
			}
		}
	}
	s.mu.Unlock()
	if suite == nil {
		var ld *models.Suite
		ld, err = runner.LoadSuite(path)
		if err != nil {
			out(evt{Type: "error", Payload: map[string]any{"path": path, "error": err.Error()}})
			return
		}
		suite = ld
	}
	// compute totals and stage counts from loaded suite
	stageCounts := map[int]int{}
	total := 0
	// detect dependsOn DAG usage
	hasDeps := false
	for _, tc := range suite.Tests {
		if len(tc.DependsOn) > 0 {
			hasDeps = true
			break
		}
	}
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
		if !hasDeps {
			stageCounts[tc.Stage] = stageCounts[tc.Stage] + combos
		}
	}
	if hasDeps {
		// For dependsOn chains, we render a single stage (0) with total equal to all runnable tests
		stageCounts = map[int]int{0: total}
	}
	out(evt{Type: "suiteStart", Payload: map[string]any{"path": path, "name": suite.Name, "total": total, "stages": stageCounts}})
	var allResults []runner.TestResult
	runWithSuite := func() (runner.Summary, error) {
		return runner.RunSuite(ctx, suite, runner.Options{Workers: workers, Tags: tags, DefaultTimeoutMs: defaultTimeout, OnStart: func(tr runner.TestResult) {
			// include suite path to disambiguate FE counters
			out(evt{Type: "testStart", Payload: map[string]any{
				"path":       path,
				"Name":       tr.Name,
				"Stage":      tr.Stage,
				"Tags":       tr.Tags,
				"Status":     tr.Status,
				"DurationMs": tr.DurationMs,
				"Messages":   tr.Messages,
			}})
		}, OnResult: func(tr runner.TestResult) {
			// collect results for detailed report and stream events
			allResults = append(allResults, tr)
			// include suite path to disambiguate FE counters
			out(evt{Type: "test", Payload: map[string]any{
				"path":       path,
				"Name":       tr.Name,
				"Stage":      tr.Stage,
				"Tags":       tr.Tags,
				"Status":     tr.Status,
				"DurationMs": tr.DurationMs,
				"Messages":   tr.Messages,
			}})
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

	// Build and persist a detailed report for this suite so downloads work like CLI
	dr := report.DetailedReport{
		Suite:   suite.Name,
		Summary: report.FromRunner(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration),
	}
	for _, r := range allResults {
		tc := report.TestCase{
			Name:       r.Name,
			Stage:      r.Stage,
			Tags:       r.Tags,
			Status:     r.Status,
			DurationMs: r.DurationMs,
			Messages:   r.Messages,
		}
		dr.TestCases = append(dr.TestCases, tc)
	}

	// write files under reports/ using runTS recorded for the run (or fallback)
	if err := os.MkdirAll("reports", 0o755); err == nil {
		// find runTS using the runId provided to this function
		s.mu.Lock()
		runTS := ""
		if m, ok := s.reports[runId]; ok {
			if v, ok2 := m["runTS"]; ok2 {
				if sTS, ok3 := v.(string); ok3 {
					runTS = sTS
				}
			}
		}
		if runTS == "" {
			runTS = time.Now().Format("20060102-150405")
		}
		s.mu.Unlock()
		fnameBase := sanitizeFilename(suite.Name)
		outHTML := filepath.Join("reports", fmt.Sprintf("%s-%s.html", fnameBase, runTS))
		_ = report.WriteHTMLDetailed(outHTML, dr)
		outJSON := filepath.Join("reports", fmt.Sprintf("%s-%s.json", fnameBase, runTS))
		_ = report.WriteJSONDetailed(outJSON, dr)
		// store in in-memory reports map under the run that owns this execution if present
		s.mu.Lock()
		for rid, m := range s.reports {
			if m == nil {
				continue
			}
			// heuristics: if streams exist for rid, associate
			if _, ok := s.streams[rid]; ok {
				s.reports[rid][path+"::detailed"] = dr
				break
			}
		}
		s.mu.Unlock()
	}
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

func sanitizeFilename(s string) string {
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, "/", "-")
	return s
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
