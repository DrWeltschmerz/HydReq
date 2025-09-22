package assert

import "testing"

func TestEqual(t *testing.T) {
	r := Equal(1, 1, "num")
	if !r.Passed {
		t.Fatalf("expected pass, got: %+v", r)
	}
	r = Equal(1, 2, "num")
	if r.Passed {
		t.Fatalf("expected fail, got: %+v", r)
	}
}

func TestContains(t *testing.T) {
	r := Contains("hello world", "world", "body")
	if !r.Passed {
		t.Fatalf("expected pass, got: %+v", r)
	}
	r = Contains("hello", "bye", "body")
	if r.Passed {
		t.Fatalf("expected fail, got: %+v", r)
	}
}
