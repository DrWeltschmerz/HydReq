package restclient

import (
	"strings"
	"testing"
)

func TestConvert(t *testing.T) {
	httpContent := `GET https://api.example.com/users
Authorization: Bearer token123
Content-Type: application/json

###

POST https://api.example.com/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

###

PUT https://api.example.com/users/123
Authorization: Bearer token123
Content-Type: application/json

{
  "name": "Jane Doe"
}
`

	reader := strings.NewReader(httpContent)
	suite, err := Convert(reader)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if suite.Name != "REST Client Import" {
		t.Errorf("Expected suite name 'REST Client Import', got '%s'", suite.Name)
	}

	if len(suite.Tests) != 3 {
		t.Errorf("Expected 3 tests, got %d", len(suite.Tests))
	}

	// Test first request (GET)
	getTest := suite.Tests[0]
	if getTest.Request.Method != "GET" {
		t.Errorf("Expected GET method, got %s", getTest.Request.Method)
	}
	if getTest.Request.URL != "https://api.example.com/users" {
		t.Errorf("Expected URL 'https://api.example.com/users', got '%s'", getTest.Request.URL)
	}
	if getTest.Request.Headers["Authorization"] != "Bearer token123" {
		t.Errorf("Expected Authorization header, got %v", getTest.Request.Headers)
	}

	// Test second request (POST)
	postTest := suite.Tests[1]
	if postTest.Request.Method != "POST" {
		t.Errorf("Expected POST method, got %s", postTest.Request.Method)
	}
	expectedBody := `{
"name": "John Doe",
"email": "john@example.com"
}`
	if postTest.Request.Body != expectedBody {
		t.Errorf("Expected body '%s', got '%s'", expectedBody, postTest.Request.Body)
	}

	// Test third request (PUT)
	putTest := suite.Tests[2]
	if putTest.Request.Method != "PUT" {
		t.Errorf("Expected PUT method, got %s", putTest.Request.Method)
	}
}

func TestConvert_RESTClientWithQueryParams(t *testing.T) {
	httpContent := `GET https://api.example.com/search?q=test&limit=10
Content-Type: application/json
`

	reader := strings.NewReader(httpContent)
	suite, err := Convert(reader)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if len(suite.Tests) != 1 {
		t.Fatalf("Expected 1 test, got %d", len(suite.Tests))
	}

	test := suite.Tests[0]
	if test.Request.Method != "GET" {
		t.Fatalf("Expected GET method, got %s", test.Request.Method)
	}
	if test.Request.URL != "https://api.example.com/search" {
		t.Fatalf("Expected URL 'https://api.example.com/search', got '%s'", test.Request.URL)
	}
	if test.Request.Query["q"] != "test" {
		t.Fatalf("Expected query param q=test, got %v", test.Request.Query)
	}
	if test.Request.Query["limit"] != "10" {
		t.Fatalf("Expected query param limit=10, got %v", test.Request.Query)
	}
}

func TestConvert_RESTClientEmpty(t *testing.T) {
	reader := strings.NewReader("")
	suite, err := Convert(reader)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if len(suite.Tests) != 0 {
		t.Fatalf("Expected 0 tests for empty input, got %d", len(suite.Tests))
	}
}

func TestConvert_RESTClientMalformed(t *testing.T) {
	httpContent := `INVALID https://api.example.com
Content-Type: application/json

###

GET https://api.example.com/valid
`

	reader := strings.NewReader(httpContent)
	suite, err := Convert(reader)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	// Should skip invalid request and process valid one
	if len(suite.Tests) != 1 {
		t.Fatalf("Expected 1 test (skipping invalid), got %d", len(suite.Tests))
	}

	test := suite.Tests[0]
	if test.Request.Method != "GET" {
		t.Fatalf("Expected GET method, got %s", test.Request.Method)
	}
}

func TestConvert_RESTClientMultipleHeaders(t *testing.T) {
	httpContent := `POST https://api.example.com/data
Authorization: Bearer token123
Content-Type: application/json
X-Custom-Header: value1
X-Custom-Header: value2
`

	reader := strings.NewReader(httpContent)
	suite, err := Convert(reader)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if len(suite.Tests) != 1 {
		t.Fatalf("Expected 1 test, got %d", len(suite.Tests))
	}

	test := suite.Tests[0]
	if test.Request.Headers["Authorization"] != "Bearer token123" {
		t.Fatalf("Expected Authorization header, got %v", test.Request.Headers)
	}
	if test.Request.Headers["Content-Type"] != "application/json" {
		t.Fatalf("Expected Content-Type header, got %v", test.Request.Headers)
	}
	// Multiple headers with same name: last one wins
	if test.Request.Headers["X-Custom-Header"] != "value2" {
		t.Fatalf("Expected X-Custom-Header to be 'value2' (last value), got %v", test.Request.Headers)
	}
}
