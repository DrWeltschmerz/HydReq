package webui

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestHandleEditorSuites(t *testing.T) {
	// create a temporary working dir with a testdata/ sample so findSuites will find files
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	if err := os.MkdirAll(tdTestdata, 0o755); err != nil {
		t.Fatalf("failed to create testdata dir: %v", err)
	}
	samplePath := filepath.Join(tdTestdata, "sample.yaml")
	sampleYAML := "name: sample suite\ntests: []\n"
	if err := os.WriteFile(samplePath, []byte(sampleYAML), 0o644); err != nil {
		t.Fatalf("failed to write sample yaml: %v", err)
	}
	// switch working directory to tempdir so findSuites() sees td/testdata
	oldwd, _ := os.Getwd()
	if err := os.Chdir(td); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	defer func() { _ = os.Chdir(oldwd) }()

	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}, reports: map[string]map[string]any{}}
	s.routes()

	req := httptest.NewRequest(http.MethodGet, "/api/editor/suites", nil)
	w := httptest.NewRecorder()
	s.handleEditorSuites(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var out []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(out) == 0 {
		t.Fatalf("expected at least one suite in testdata")
	}
	// each item should have a path string
	for i, it := range out {
		if _, ok := it["path"]; !ok {
			t.Fatalf("item %d missing path field: %v", i, it)
		}
	}

}

func TestHandleEditorCheckPath(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	if err := os.MkdirAll(tdTestdata, 0o755); err != nil {
		t.Fatalf("failed to create testdata dir: %v", err)
	}
	samplePath := filepath.Join(tdTestdata, "new.yaml")
	sampleYAML := "name: new suite\n"
	if err := os.WriteFile(samplePath, []byte(sampleYAML), 0o644); err != nil {
		t.Fatalf("failed to write sample yaml: %v", err)
	}
	// chdir into td so isEditablePath and file checks operate relative to temp dir
	oldwd, _ := os.Getwd()
	if err := os.Chdir(td); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	defer func() { _ = os.Chdir(oldwd) }()

	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}, reports: map[string]map[string]any{}}
	s.routes()

	reqBody := map[string]string{"path": "testdata/new.yaml"}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/api/editor/checkpath", bytes.NewReader(b))
	w := httptest.NewRecorder()
	s.handleEditorCheckPath(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var resp map[string]bool
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if safe, ok := resp["safe"]; !ok || !safe {
		t.Fatalf("expected safe=true for testdata/new.yaml, got %v", resp)
	}
	if exists, ok := resp["exists"]; !ok || !exists {
		t.Fatalf("expected exists=true for testdata/new.yaml, got %v", resp)
	}
}
