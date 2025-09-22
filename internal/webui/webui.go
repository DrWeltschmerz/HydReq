package webui

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/DrWeltschmerz/HydReq/internal/runner"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
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
	// Serve the embedded static/ directory at the root so / loads index.html directly
	if sub, err := fs.Sub(staticFS, "static"); err == nil {
		s.mux.Handle("/", http.FileServer(http.FS(sub)))
	} else {
		// Fallback: serve the entire FS (will expose a 'static' directory link)
		s.mux.Handle("/", http.FileServer(http.FS(staticFS)))
	}
}

func (s *server) handleSuites(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	list := findSuites()
	json.NewEncoder(w).Encode(list)
}

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
	for _, path := range suites {
		select {
		case <-ctx.Done():
			break
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
	if len(env) > 0 {
		// serialize env overrides to avoid races
		s.envMu.Lock()
		sum, _ = withEnv(env, runWithSuite)
		s.envMu.Unlock()
	} else {
		sum, _ = runWithSuite()
	}
	// Note: runner returns an error when tests fail; we surface that via suiteEnd summary only.
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
