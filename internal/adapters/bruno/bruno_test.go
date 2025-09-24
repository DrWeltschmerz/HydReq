package bruno

import (
	"strings"
	"testing"
)

func TestConvert_Minimal(t *testing.T) {
	js := `{"name":"bruno-demo","requests":[{"name":"one","method":"GET","url":"https://example.com"}]}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Name != "bruno-demo" {
		t.Fatalf("name: %s", s.Name)
	}
	if len(s.Tests) != 1 || s.Tests[0].Request.Method != "GET" {
		t.Fatalf("bad tests: %+v", s.Tests)
	}
}

func TestConvert_Items(t *testing.T) {
	js := `{
		"name": "bruno-collection",
		"items": [
			{
				"name": "folder1",
				"type": "folder",
				"items": [
					{
						"name": "test1",
						"type": "http-request",
						"request": {
							"method": "GET",
							"url": "https://api.example.com/users"
						}
					}
				]
			},
			{
				"name": "test2",
				"type": "http-request",
				"request": {
					"method": "POST",
					"url": "https://api.example.com/users",
					"headers": [
						{"name": "Content-Type", "value": "application/json", "enabled": true}
					],
					"params": [
						{"name": "page", "value": "1", "enabled": true}
					],
					"body": {
						"mode": "json",
						"json": "{\"name\":\"test\"}"
					}
				}
			}
		]
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Name != "bruno-collection" {
		t.Fatalf("name: %s", s.Name)
	}
	if len(s.Tests) != 2 {
		t.Fatalf("expected 2 tests, got %d", len(s.Tests))
	}

	// Check folder prefix
	if s.Tests[0].Name != "folder1/test1" {
		t.Fatalf("expected folder prefix, got %s", s.Tests[0].Name)
	}
	if s.Tests[0].Request.Method != "GET" {
		t.Fatalf("method: %s", s.Tests[0].Request.Method)
	}

	// Check headers and query
	if s.Tests[1].Request.Headers["Content-Type"] != "application/json" {
		t.Fatalf("headers: %+v", s.Tests[1].Request.Headers)
	}
	if s.Tests[1].Request.Query["page"] != "1" {
		t.Fatalf("query: %+v", s.Tests[1].Request.Query)
	}
	if s.Tests[1].Request.Body != "{\"name\":\"test\"}" {
		t.Fatalf("body: %v", s.Tests[1].Request.Body)
	}
}

func TestConvert_Auth(t *testing.T) {
	js := `{
		"name": "auth-test",
		"items": [
			{
				"name": "basic-auth",
				"type": "http-request",
				"request": {
					"method": "GET",
					"url": "https://api.example.com",
					"auth": {
						"mode": "basic",
						"basic": {
							"username": "user",
							"password": "pass"
						}
					}
				}
			},
			{
				"name": "bearer-auth",
				"type": "http-request",
				"request": {
					"method": "GET",
					"url": "https://api.example.com",
					"auth": {
						"mode": "bearer",
						"bearer": {
							"token": "abc123"
						}
					}
				}
			}
		]
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	// Auth conversion is placeholder for now - would need env setup
	if len(s.Tests) != 2 {
		t.Fatalf("expected 2 tests, got %d", len(s.Tests))
	}
}

func TestConvert_Bodies(t *testing.T) {
	js := `{
		"name": "bodies-test",
		"items": [
			{
				"name": "json-body",
				"type": "http-request",
				"request": {
					"method": "POST",
					"url": "https://api.example.com",
					"body": {
						"mode": "json",
						"json": "{\"key\":\"value\"}"
					}
				}
			},
			{
				"name": "form-body",
				"type": "http-request",
				"request": {
					"method": "POST",
					"url": "https://api.example.com",
					"body": {
						"mode": "formUrlEncoded",
						"formUrlEncoded": [
							{"name": "field1", "value": "value1", "enabled": true},
							{"name": "field2", "value": "value2", "enabled": true}
						]
					}
				}
			}
		]
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(s.Tests) != 2 {
		t.Fatalf("expected 2 tests, got %d", len(s.Tests))
	}

	if s.Tests[0].Request.Body != "{\"key\":\"value\"}" {
		t.Fatalf("json body: %v", s.Tests[0].Request.Body)
	}

	bodyMap, ok := s.Tests[1].Request.Body.(map[string]string)
	if !ok {
		t.Fatalf("form body type: %T", s.Tests[1].Request.Body)
	}
	if bodyMap["field1"] != "value1" || bodyMap["field2"] != "value2" {
		t.Fatalf("form body: %+v", bodyMap)
	}
}

func TestConvert_Scripts(t *testing.T) {
	js := `{
		"name": "scripts-test",
		"items": [
			{
				"name": "with-scripts",
				"type": "http-request",
				"request": {
					"method": "GET",
					"url": "https://api.example.com",
					"script": {
						"req": "console.log('pre');",
						"res": "console.log('post');"
					}
				}
			}
		]
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(s.Tests) != 1 {
		t.Fatalf("expected 1 test, got %d", len(s.Tests))
	}

	tc := s.Tests[0]
	if len(tc.Pre) != 1 || tc.Pre[0].JS == nil || tc.Pre[0].JS.Code != "console.log('pre');" {
		t.Fatalf("pre script: %+v", tc.Pre)
	}
	if len(tc.Post) != 1 || tc.Post[0].JS == nil || tc.Post[0].JS.Code != "console.log('post');" {
		t.Fatalf("post script: %+v", tc.Post)
	}
}

func TestConvert_Environments(t *testing.T) {
	js := `{
		"name": "env-test",
		"environments": [
			{
				"name": "dev",
				"variables": [
					{"name": "baseUrl", "value": "https://api.example.com", "enabled": true},
					{"name": "apiKey", "value": "dev-key-123", "enabled": true},
					{"name": "disabledVar", "value": "should-not-appear", "enabled": false}
				]
			}
		],
		"items": [
			{
				"name": "test",
				"type": "http-request",
				"request": {
					"method": "GET",
					"url": "{{baseUrl}}/test"
				}
			}
		]
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Variables["baseUrl"] != "https://api.example.com" {
		t.Fatalf("baseUrl not extracted: %+v", s.Variables)
	}
	if s.Variables["apiKey"] != "dev-key-123" {
		t.Fatalf("apiKey not extracted: %+v", s.Variables)
	}
	if s.Variables["disabledVar"] != "" {
		t.Fatalf("disabled variable should not be present: %+v", s.Variables)
	}
}

func TestConvert_EmptyInput(t *testing.T) {
	_, err := Convert(strings.NewReader(""))
	if err == nil {
		t.Fatal("expected error for empty input")
	}
}

func TestConvert_InvalidJSON(t *testing.T) {
	_, err := Convert(strings.NewReader(`{"invalid": json}`))
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}
