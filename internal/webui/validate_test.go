package webui

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"testing"
)

func TestHandleEditorValidate_AuthEnvDetection(t *testing.T) {
	s := &server{}
	// Case 1: bearerEnv is a literal token (not env-like) -> should NOT produce an info issue
	raw := `name: foo
auth:
  bearerEnv: "myliteral-token-123"
tests: []`
	req := httptest.NewRequest("POST", "/api/editor/validate", bytes.NewReader([]byte(`{"raw":`+string(jsonEscape(raw))+`}`)))
	w := httptest.NewRecorder()
	s.handleEditorValidate(w, req)
	if w.Code != 200 {
		t.Fatalf("expected 200 got %d: %s", w.Code, w.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	// parsed input should produce a YAML serialization in response
	if _, ok := resp["yaml"]; !ok {
		t.Fatalf("expected yaml in validate response for parsed content")
	}
	// issues should not contain auth.bearerEnv info
	if arr, ok := resp["issues"].([]interface{}); ok {
		for _, it := range arr {
			m, _ := it.(map[string]interface{})
			if p, _ := m["path"].(string); p == "auth.bearerEnv" {
				t.Fatalf("unexpected issue for auth.bearerEnv when literal provided: %v", m)
			}
		}
	}

	// Case 2: bearerEnv looks like an env name and is not set in env -> should produce info
	raw2 := `name: foo
auth:
    bearerEnv: "SOME_ENV_NAME"
tests: []`
	req2 := httptest.NewRequest("POST", "/api/editor/validate", bytes.NewReader([]byte(`{"raw":`+string(jsonEscape(raw2))+`}`)))
	w2 := httptest.NewRecorder()
	// Ensure env unset
	os.Unsetenv("SOME_ENV_NAME")
	s.handleEditorValidate(w2, req2)
	if w2.Code != 200 {
		t.Fatalf("expected 200 got %d: %s", w2.Code, w2.Body.String())
	}
	var resp2 map[string]interface{}
	if err := json.Unmarshal(w2.Body.Bytes(), &resp2); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	found := false
	if arr, ok := resp2["issues"].([]interface{}); ok {
		for _, it := range arr {
			m, _ := it.(map[string]interface{})
			if p, _ := m["path"].(string); p == "auth.bearerEnv" {
				found = true
			}
		}
	}
	if !found {
		t.Fatalf("expected info issue for auth.bearerEnv when env-like name is unset")
	}
}

// jsonEscape wraps a string into a JSON string literal safely
func jsonEscape(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}
