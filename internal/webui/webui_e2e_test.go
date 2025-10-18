package webui

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// This test exercises the editor HTTP endpoints at a level suitable for CI without a browser.
// It posts a parsed Suite (visual edit), expects YAML returned, posts that YAML back as raw and expects parsing,
// and then saves the YAML to a testdata file and verifies the file was written.
func TestEditorVisualYamlSaveE2E(t *testing.T) {
	s := &server{mux: http.NewServeMux(), streams: map[string]chan string{}, runs: map[string]context.CancelFunc{}, ready: map[string]chan struct{}{}, reports: map[string]map[string]any{}}
	s.routes()
	ts := httptest.NewServer(s.mux)
	defer ts.Close()

	suite := models.Suite{
		Name:      "e2e-suite",
		Variables: map[string]string{"1234": "v1"},
		Tests:     []models.TestCase{{Name: "case1", Request: models.Request{Method: "GET", URL: "/ping"}}},
	}

	// Validate as parsed (visual -> server canonical YAML)
	p := map[string]any{"parsed": suite}
	pb, _ := json.Marshal(p)
	res, err := http.Post(ts.URL+"/api/editor/validate", "application/json", bytes.NewReader(pb))
	if err != nil {
		t.Fatalf("validate(parsed) request failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("validate(parsed) status %d", res.StatusCode)
	}
	var vr validateResp
	if err := json.NewDecoder(res.Body).Decode(&vr); err != nil {
		t.Fatalf("decode validate(parsed) response: %v", err)
	}
	if !vr.OK {
		t.Fatalf("expected OK from validate(parsed); got issues: %+v", vr.Issues)
	}
	if vr.YAML == "" {
		t.Fatalf("expected YAML in validate(parsed) response")
	}

	// Now validate the raw YAML returned
	r2 := map[string]any{"raw": vr.YAML}
	r2b, _ := json.Marshal(r2)
	res2, err := http.Post(ts.URL+"/api/editor/validate", "application/json", bytes.NewReader(r2b))
	if err != nil {
		t.Fatalf("validate(raw) request failed: %v", err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("validate(raw) status %d", res2.StatusCode)
	}
	var vr2 validateResp
	if err := json.NewDecoder(res2.Body).Decode(&vr2); err != nil {
		t.Fatalf("decode validate(raw) response: %v", err)
	}
	if !vr2.OK {
		t.Fatalf("expected OK from validate(raw); got issues: %+v", vr2.Issues)
	}

	// Save the YAML to a testdata path and assert file written
	path := "testdata/e2e_test_suite.hrq.yaml"
	_ = os.Remove(path)
	t.Cleanup(func() { _ = os.Remove(path) })
	save := map[string]any{"path": path, "raw": vr.YAML}
	sb, _ := json.Marshal(save)
	res3, err := http.Post(ts.URL+"/api/editor/save", "application/json", bytes.NewReader(sb))
	if err != nil {
		t.Fatalf("save request failed: %v", err)
	}
	defer res3.Body.Close()
	if res3.StatusCode != http.StatusOK {
		// attempt to read body for diagnostic
		var b bytes.Buffer
		_, _ = b.ReadFrom(res3.Body)
		t.Fatalf("save status %d: %s", res3.StatusCode, b.String())
	}
	var sr map[string]any
	if err := json.NewDecoder(res3.Body).Decode(&sr); err != nil {
		t.Fatalf("decode save response: %v", err)
	}
	if saved, ok := sr["saved"].(bool); !ok || !saved {
		t.Fatalf("expected saved=true in save response; got: %+v", sr)
	}
	// verify file content
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read saved file: %v", err)
	}
	if string(got) != vr.YAML {
		t.Fatalf("saved file content mismatch. want:\n%s\n---\n got:\n%s", vr.YAML, string(got))
	}
}
