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
