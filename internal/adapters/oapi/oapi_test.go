package oapi

import (
	"strings"
	"testing"
)

func TestConvert_Basic(t *testing.T) {
	y := `openapi: 3.0.3
info:
  title: Demo API
servers:
  - url: https://api.example.com
paths:
  /things:
    get:
      responses:
        "200": { description: ok }
    post:
      responses:
        "201": { description: created }
`
	s, err := Convert(strings.NewReader(y))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Name != "Demo API" {
		t.Fatalf("suite name: %s", s.Name)
	}
	if s.BaseURL != "https://api.example.com" {
		t.Fatalf("baseUrl: %s", s.BaseURL)
	}
	if len(s.Tests) != 2 {
		t.Fatalf("tests: %d", len(s.Tests))
	}
	if s.Tests[0].Assert.Status != 200 {
		t.Fatalf("status0: %d", s.Tests[0].Assert.Status)
	}
	if s.Tests[1].Assert.Status != 201 {
		t.Fatalf("status1: %d", s.Tests[1].Assert.Status)
	}
}

func TestConvert_OpenAPIWithSecurity(t *testing.T) {
	y := `openapi: 3.0.3
info:
  title: Secure API
servers:
  - url: https://api.example.com
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
paths:
  /secure:
    get:
      security:
        - bearerAuth: []
      responses:
        "200": { description: ok }
`
	s, err := Convert(strings.NewReader(y))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Auth == nil || s.Auth.BearerEnv != "token" {
		t.Fatalf("auth not converted: %+v", s.Auth)
	}
}

func TestConvert_OpenAPIInvalidYAML(t *testing.T) {
	_, err := Convert(strings.NewReader(`invalid: yaml: content: [`))
	if err == nil {
		t.Fatal("expected error for invalid YAML")
	}
}

func TestConvert_OpenAPIEmpty(t *testing.T) {
	y := `openapi: 3.0.3
info:
  title: Empty API
paths: {}
`
	s, err := Convert(strings.NewReader(y))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if len(s.Tests) != 0 {
		t.Fatalf("expected 0 tests for empty API")
	}
}
