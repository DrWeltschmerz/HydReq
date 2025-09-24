package insomnia

import (
	"strings"
	"testing"
)

func TestConvertMinimal(t *testing.T) {
	js := `{"resources":[{"_type":"request","name":"get","method":"GET","url":"https://httpbin.org/get"}]}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Tests) != 1 || s.Tests[0].Request.Method != "GET" {
		t.Fatalf("unexpected: %+v", s)
	}
}

func TestConvertV5Collection(t *testing.T) {
	js := `{
		"type": "collection.insomnia.rest/5.0",
		"name": "Test Collection",
		"collection": {
			"items": [
				{
					"type": "http-request",
					"name": "Get Request",
					"request": {
						"method": "GET",
						"url": "https://httpbin.org/get",
						"headers": [{"name": "Accept", "value": "application/json"}],
						"body": {"mimeType": "application/json", "text": "{\"key\": \"value\"}"}
					}
				}
			]
		}
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "Test Collection" || len(s.Tests) != 1 {
		t.Fatalf("unexpected suite: %+v", s)
	}
	test := s.Tests[0]
	if test.Name != "Get Request" || test.Request.Method != "GET" || test.Request.URL != "https://httpbin.org/get" {
		t.Fatalf("unexpected test: %+v", test)
	}
	if test.Request.Headers["Accept"] != "application/json" {
		t.Fatalf("unexpected headers: %+v", test.Request.Headers)
	}
	if test.Request.Body != "{\"key\": \"value\"}" {
		t.Fatalf("unexpected body: %+v", test.Request.Body)
	}
}

func TestConvertV5WithEnvironment(t *testing.T) {
	js := `{
		"type": "collection.insomnia.rest/5.0",
		"name": "Env Test",
		"environments": [
			{
				"name": "Dev",
				"data": {"baseUrl": "https://dev.api.com", "token": "abc123"}
			}
		],
		"collection": {
			"items": [
				{
					"type": "http-request",
					"name": "Test",
					"request": {"method": "GET", "url": "https://httpbin.org/get"}
				}
			]
		}
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatal(err)
	}
	if s.Variables["baseUrl"] != "https://dev.api.com" || s.Variables["token"] != "abc123" {
		t.Fatalf("unexpected vars: %+v", s.Variables)
	}
}

func TestConvertMalformedInsomnia(t *testing.T) {
	_, err := Convert(strings.NewReader(`{"type": "invalid", "bad": json}`))
	if err == nil {
		t.Fatal("expected error for malformed input")
	}
}

func TestConvertEmptyInsomniaCollection(t *testing.T) {
	js := `{
		"type": "collection.insomnia.rest/5.0",
		"name": "Empty",
		"collection": {"items": []}
	}`
	s, err := Convert(strings.NewReader(js))
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Tests) != 0 {
		t.Fatalf("expected 0 tests for empty collection")
	}
}
