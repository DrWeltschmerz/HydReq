package postman

import (
	"strings"
	"testing"
)

func TestConvertMinimal(t *testing.T) {
	js := `{"info":{"name":"mini"},"item":[{"name":"get","request":{"method":"GET","url":"https://httpbin.org/get"}}]}`
	s, err := Convert(strings.NewReader(js))
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
