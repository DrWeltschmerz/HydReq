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

func TestEditorSuiteValidateSaveRoundtrip(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	if err := os.MkdirAll(tdTestdata, 0o755); err != nil {
		t.Fatalf("failed to create testdata dir: %v", err)
	}
	samplePath := filepath.Join(tdTestdata, "round.yaml")
	sampleYAML := "name: roundtrip suite\n"
	if err := os.WriteFile(samplePath, []byte(sampleYAML), 0o644); err != nil {
		t.Fatalf("failed to write sample yaml: %v", err)
	}
	oldwd, _ := os.Getwd()
	if err := os.Chdir(td); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	defer func() { _ = os.Chdir(oldwd) }()

	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}, reports: map[string]map[string]any{}}
	s.routes()

	// fetch single suite
	req := httptest.NewRequest(http.MethodGet, "/api/editor/suite?path=testdata/round.yaml", nil)
	w := httptest.NewRecorder()
	s.handleEditorSuite(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for suite fetch, got %d", w.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("failed to decode suite response: %v", err)
	}
	if _, ok := got["raw"]; !ok {
		t.Fatalf("expected raw field in suite response")
	}

	// validate payload
	raw := got["raw"].(string)
	vpayload := map[string]string{"raw": raw}
	b, _ := json.Marshal(vpayload)
	vreq := httptest.NewRequest(http.MethodPost, "/api/editor/validate", bytes.NewReader(b))
	vreq.Header.Set("Content-Type", "application/json")
	vw := httptest.NewRecorder()
	s.handleEditorValidate(vw, vreq)
	if vw.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for validate, got %d", vw.Code)
	}

	// save to a new path
	savePayload := map[string]string{"path": "testdata/round_saved.yaml", "raw": raw}
	sb, _ := json.Marshal(savePayload)
	sreq := httptest.NewRequest(http.MethodPost, "/api/editor/save", bytes.NewReader(sb))
	sreq.Header.Set("Content-Type", "application/json")
	sw := httptest.NewRecorder()
	s.handleEditorSave(sw, sreq)
	if sw.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for save, got %d: %s", sw.Code, sw.Body.String())
	}
	// confirm saved file exists and content matches
	savedData, err := os.ReadFile(filepath.Join(tdTestdata, "round_saved.yaml"))
	if err != nil {
		t.Fatalf("failed to read saved file: %v", err)
	}
	if string(savedData) != raw {
		t.Fatalf("saved content mismatch: got %q expected %q", string(savedData), raw)
	}
	// cleanup
	_ = os.Remove(filepath.Join(tdTestdata, "round_saved.yaml"))
}
