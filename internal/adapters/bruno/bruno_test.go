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
