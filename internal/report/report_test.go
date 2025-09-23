package report

import (
	"os"
	"strings"
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
	f, err := os.CreateTemp(t.TempDir(), "det-*.json")
	if err != nil {
		t.Fatal(err)
	}
	// Close to avoid cross-platform file lock issues when writers reopen the path.
	_ = f.Close()
	rep := DetailedReport{Suite: "demo", Summary: Summary{Total: 2, Passed: 1, Failed: 1}, TestCases: []TestCase{{Name: "a", Status: "passed"}, {Name: "b", Status: "failed", Messages: []string{"oops"}}}}
	if err := WriteJSONDetailed(f.Name(), rep); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	if string(b) == "" || string(b)[0] != '{' {
		t.Fatal("invalid detailed json")
	}
}

func TestWriteJUnitDetailed(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "junit-*.xml")
	if err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	tests := []TestCase{{Name: "ok", Status: "passed"}, {Name: "skip", Status: "skipped"}, {Name: "bad", Status: "failed", Messages: []string{"boom"}}}
	if err := WriteJUnitDetailed(f.Name(), "suite", Summary{Total: 3, Passed: 1, Failed: 1, Skipped: 1}, tests); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	if len(b) == 0 || b[0] != '<' {
		t.Fatal("invalid junit xml")
	}
}

func TestWriteHTMLDetailed(t *testing.T) {
	f, err := os.CreateTemp(t.TempDir(), "html-*.html")
	if err != nil {
		t.Fatal(err)
	}
	_ = f.Close()
	rep := DetailedReport{
		Suite:   "suite",
		Summary: Summary{Total: 2, Passed: 1, Failed: 1, Duration: 123456789},
		TestCases: []TestCase{
			{Name: "ok", Status: "passed", DurationMs: 10},
			{Name: "bad", Status: "failed", Messages: []string{"boom"}, DurationMs: 20},
		},
	}
	if err := WriteHTMLDetailed(f.Name(), rep); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	if !strings.Contains(s, "HydReq Report") || !strings.Contains(s, "table table-zebra") {
		// Cap preview length safely without relying on custom min helpers.
		if len(s) > 200 {
			s = s[:200]
		}
		t.Fatalf("html output missing expected content: %s", s)
	}
}
