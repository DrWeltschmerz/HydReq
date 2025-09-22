package har

import (
	"strings"
	"testing"
)

func TestConvertSimple(t *testing.T) {
	harJSON := `{
        "log": {
            "creator": {"name": "har-sample"},
            "entries": [
                {"request": {"method": "GET", "url": "https://example.com/api", "headers": [{"name":"Accept","value":"application/json"}]}}
            ]
        }
    }`
	s, err := Convert(strings.NewReader(harJSON))
	if err != nil {
		t.Fatalf("convert: %v", err)
	}
	if s.Name != "har-sample" {
		t.Fatalf("suite name: %s", s.Name)
	}
	if len(s.Tests) != 1 {
		t.Fatalf("tests count: %d", len(s.Tests))
	}
	tc := s.Tests[0]
	if tc.Request.Method != "GET" || tc.Request.URL != "https://example.com/api" {
		t.Fatalf("unexpected request: %+v", tc.Request)
	}
	if tc.Assert.Status != 200 {
		t.Fatalf("expected default status 200, got %d", tc.Assert.Status)
	}
}
