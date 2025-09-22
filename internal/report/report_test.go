package report

import (
	"os"
	"testing"
)

func TestWriteJSONSummary(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "sum-*.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := WriteJSONSummary(f.Name(), Summary{Total: 1, Passed: 1}); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	if len(b) == 0 {
		t.Fatal("empty summary json")
	}
}

func TestWriteJSONDetailed(t *testing.T) {
	f, _ := os.CreateTemp(t.TempDir(), "det-*.json")
	rep := DetailedReport{Suite: "demo", Summary: Summary{Total: 2, Passed: 1, Failed: 1}, TestCases: []TestCase{{Name: "a", Status: "passed"}, {Name: "b", Status: "failed", Messages: []string{"oops"}}}}
	if err := WriteJSONDetailed(f.Name(), rep); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(f.Name())
	if string(b) == "" || string(b)[0] != '{' {
		t.Fatal("invalid detailed json")
	}
}

func TestWriteJUnitDetailed(t *testing.T) {
	f, _ := os.CreateTemp(t.TempDir(), "junit-*.xml")
	tests := []TestCase{{Name: "ok", Status: "passed"}, {Name: "skip", Status: "skipped"}, {Name: "bad", Status: "failed", Messages: []string{"boom"}}}
	if err := WriteJUnitDetailed(f.Name(), "suite", Summary{Total: 3, Passed: 1, Failed: 1, Skipped: 1}, tests); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(f.Name())
	if len(b) == 0 || b[0] != '<' {
		t.Fatal("invalid junit xml")
	}
}
