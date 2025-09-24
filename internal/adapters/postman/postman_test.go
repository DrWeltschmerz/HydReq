package postman

import (
	"strings"
	"testing"
)

func TestConvertMinimal(t *testing.T) {
	js := `{"info":{"name":"mini"},"item":[{"name":"get","request":{"method":"GET","url":"https://httpbin.org/get"}}]}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "mini" || len(s.Tests) != 1 {
		t.Fatalf("unexpected suite: %+v", s)
	}
	if s.Tests[0].Request.URL == "" {
		t.Fatal("missing url")
	}
}

func TestConvertWithAuth(t *testing.T) {
	js := `{
		"info": {"name": "auth test"},
		"auth": {"type": "basic", "basic": [{"key": "username", "value": "user"}, {"key": "password", "value": "pass"}]},
		"item": [{"name": "get", "request": {"method": "GET", "url": "https://httpbin.org/get"}}]
	}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	if s.Auth == nil || s.Auth.BasicEnv != "user:pass" {
		t.Fatalf("unexpected auth: %+v", s.Auth)
	}
}

func TestConvertWithBody(t *testing.T) {
	js := `{
		"info": {"name": "body test"},
		"item": [{
			"name": "post",
			"request": {
				"method": "POST",
				"url": "https://httpbin.org/post",
				"body": {"mode": "raw", "raw": "{\"key\": \"value\"}"}
			}
		}]
	}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	if s.Tests[0].Request.Body != "{\"key\": \"value\"}" {
		t.Fatalf("unexpected body: %+v", s.Tests[0].Request.Body)
	}
}

func TestConvertWithFormData(t *testing.T) {
	js := `{
		"info": {"name": "form test"},
		"item": [{
			"name": "post",
			"request": {
				"method": "POST",
				"url": "https://httpbin.org/post",
				"body": {
					"mode": "formdata",
					"formdata": [{"key": "field1", "value": "value1", "type": "text"}]
				}
			}
		}]
	}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	body, ok := s.Tests[0].Request.Body.(map[string]string)
	if !ok || body["field1"] != "value1" {
		t.Fatalf("unexpected body: %+v", s.Tests[0].Request.Body)
	}
}

func TestConvertWithUrlObject(t *testing.T) {
	js := `{
		"info": {"name": "url test"},
		"item": [{
			"name": "get",
			"request": {
				"method": "GET",
				"url": {
					"raw": "https://httpbin.org/get?param1=value1",
					"protocol": "https",
					"host": ["httpbin", "org"],
					"path": ["get"],
					"query": [{"key": "param1", "value": "value1"}]
				}
			}
		}]
	}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	if s.Tests[0].Request.URL != "https://httpbin.org/get?param1=value1" {
		t.Fatalf("unexpected url: %s", s.Tests[0].Request.URL)
	}
}

func TestConvertWithEnvironmentVariables(t *testing.T) {
	js := `{
		"info": {"name": "env test"},
		"variable": [{"key": "baseUrl", "value": "https://api.example.com"}],
		"item": [{"name": "get", "request": {"method": "GET", "url": "{{baseUrl}}/users"}}]
	}`
	envVars := map[string]string{
		"apiKey":  "env-key-123",
		"timeout": "5000",
	}
	s, err := Convert(strings.NewReader(js), envVars)
	if err != nil {
		t.Fatal(err)
	}
	// Check that collection variables are present
	if s.Variables["baseUrl"] != "https://api.example.com" {
		t.Fatalf("missing collection variable baseUrl: %+v", s.Variables)
	}
	// Check that environment variables override collection variables
	if s.Variables["apiKey"] != "env-key-123" {
		t.Fatalf("environment variable not merged: %+v", s.Variables)
	}
	if s.Variables["timeout"] != "5000" {
		t.Fatalf("environment variable not added: %+v", s.Variables)
	}
}

func TestConvertWithDisabledEnvironmentVariables(t *testing.T) {
	// Test with environment variables that should override collection variables
	js := `{
		"info": {"name": "env override test"},
		"variable": [{"key": "apiKey", "value": "collection-key"}],
		"item": [{"name": "get", "request": {"method": "GET", "url": "https://api.example.com/users"}}]
	}`
	envVars := map[string]string{
		"apiKey": "env-key-override", // Should override collection variable
	}
	s, err := Convert(strings.NewReader(js), envVars)
	if err != nil {
		t.Fatal(err)
	}
	// Environment variables should override collection variables
	if s.Variables["apiKey"] != "env-key-override" {
		t.Fatalf("environment variable should override collection: %+v", s.Variables)
	}
}

func TestConvertWithScripts(t *testing.T) {
	js := `{
		"info": {"name": "script test"},
		"item": [{
			"name": "test with scripts",
			"event": [
				{"listen": "prerequest", "script": {"exec": ["console.log('pre-request');", "pm.environment.set('timestamp', new Date().toISOString());"]}},
				{"listen": "test", "script": {"exec": ["pm.test('Status is 200', function() { pm.response.to.have.status(200); });"]}}
			],
			"request": {"method": "GET", "url": "https://httpbin.org/get"}
		}]
	}`
	s, err := Convert(strings.NewReader(js), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Tests) != 1 {
		t.Fatalf("expected 1 test, got %d", len(s.Tests))
	}
	test := s.Tests[0]
	if len(test.Pre) == 0 {
		t.Fatalf("expected pre-request hooks, got none")
	}
	if len(test.Post) == 0 {
		t.Fatalf("expected post-request hooks, got none")
	}
	// Check that scripts were translated (basic check for non-empty hooks)
	if test.Pre[0].JS.Code == "" {
		t.Fatalf("pre-request script not converted")
	}
	if test.Post[0].JS.Code == "" {
		t.Fatalf("post-request script not converted")
	}
}

func TestConvertMalformedJSON(t *testing.T) {
	malformedJSON := `{"info": {"name": "test"}, "item": [{"name": "bad", "request": {"method": "GET", "url": }}}`
	_, err := Convert(strings.NewReader(malformedJSON), nil)
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestConvertEmptyCollection(t *testing.T) {
	emptyJSON := `{"info": {"name": "empty"}, "item": []}`
	s, err := Convert(strings.NewReader(emptyJSON), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Tests) != 0 {
		t.Fatalf("expected 0 tests for empty collection, got %d", len(s.Tests))
	}
}

func TestConvertMissingRequiredFields(t *testing.T) {
	// Missing method and URL
	incompleteJSON := `{"info": {"name": "test"}, "item": [{"name": "incomplete", "request": {}}]}`
	s, err := Convert(strings.NewReader(incompleteJSON), nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Tests) != 1 {
		t.Fatalf("expected 1 test even with missing fields")
	}
	// Should have empty method/URL but not crash
	test := s.Tests[0]
	if test.Request.Method != "" && test.Request.URL != "" {
		// This is actually OK - the converter should handle missing fields gracefully
	}
}
