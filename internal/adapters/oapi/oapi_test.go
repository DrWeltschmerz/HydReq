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
