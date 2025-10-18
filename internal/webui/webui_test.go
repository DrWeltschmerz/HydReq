package webui

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// captureOut returns a collector function and a pointer to the sink slice
func captureOut() (func(any), *[]string) {
	var mu sync.Mutex
	sink := make([]string, 0, 16)
	out := func(ev any) {
		b, _ := json.Marshal(ev)
		mu.Lock()
		sink = append(sink, string(b))
		mu.Unlock()
	}
	return out, &sink
}

func TestRun_UsesInlineSuiteWhenProvided(t *testing.T) {
	s := &server{
		streams:      map[string]chan string{},
		runs:         map[string]context.CancelFunc{},
		ready:        map[string]chan struct{}{},
		reports:      map[string]map[string]any{},
		inlineSuites: map[string]map[string]*models.Suite{},
	}
	// Prepare a runId and an inline suite under a fake path
	runId := "run-test-inline"
	path := "testdata/DOES_NOT_EXIST.hrq.yaml"
	s.inlineSuites[runId] = map[string]*models.Suite{
		path: {Name: "Inline Suite Test", Tests: nil},
	}
	out, sink := captureOut()
	// Run should complete without emitting a file-open error for the path
	s.runOneWithCtx(runId, context.Background(), path, 1, nil, nil, 0, out)
	// Ensure we saw a suiteStart and suiteEnd events referencing Inline Suite Test, and no error for open path
	var sawStart, sawEnd bool
	for _, line := range *sink {
		if !sawStart && (containsAll(line, `"type":"suiteStart"`, `"name":"Inline Suite Test"`) || containsAll(line, `"type":"suiteStart"`)) {
			sawStart = true
		}
		if !sawEnd && (containsAll(line, `"type":"suiteEnd"`) || containsAll(line, `"summary"`)) {
			sawEnd = true
		}
		if containsAll(line, `"type":"error"`, `DOES_NOT_EXIST.hrq.yaml`) {
			t.Fatalf("unexpected disk load error; inline suite was not used: %s", line)
		}
	}
	if !sawStart || !sawEnd {
		t.Fatalf("expected suiteStart and suiteEnd; got=%v", *sink)
	}
}

// containsAll checks that s contains all subs
func containsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		if !strings.Contains(s, sub) {
			return false
		}
	}
	return true
}

func TestIsEditablePath(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	if err := os.MkdirAll(filepath.Join(tdTestdata, "sub"), 0o755); err != nil {
		t.Fatalf("failed to prepare testdata dir: %v", err)
	}

	oldwd, _ := os.Getwd()
	if err := os.Chdir(td); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	defer func() { _ = os.Chdir(oldwd) }()

	tests := []struct {
		name string
		path string
		want bool
	}{
		{name: "valid hrq", path: "testdata/sample.hrq.yaml", want: true},
		{name: "valid windows separators", path: "testdata\\\\sample.hrq.yaml", want: true},
		{name: "missing suffix", path: "testdata/sample.yaml", want: false},
		{name: "legacy hrq.yml", path: "testdata/sample.hrq.yml", want: false},
		{name: "outside testdata", path: "other/sample.hrq.yaml", want: false},
		{name: "empty", path: "", want: false},
		{name: "directory", path: "testdata/", want: false},
		{name: "parent traversal", path: "../testdata/sample.hrq.yaml", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := isEditablePath(tc.path)
			if got != tc.want {
				t.Fatalf("isEditablePath(%q) = %v, want %v", tc.path, got, tc.want)
			}
		})
	}
}

func TestFindSuitesFiltersExtension(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	if err := os.MkdirAll(filepath.Join(tdTestdata, "sub"), 0o755); err != nil {
		t.Fatalf("failed to prepare testdata dir: %v", err)
	}

	valid := filepath.Join(tdTestdata, "suite.hrq.yaml")
	nested := filepath.Join(tdTestdata, "sub", "nested.hrq.yaml")
	legacy := filepath.Join(tdTestdata, "suite.yaml")
	hrqYml := filepath.Join(tdTestdata, "alt.hrq.yml")

	payload := []byte("name: demo\nbaseUrl: http://example.com\ntests: []\n")
	for _, file := range []string{valid, nested} {
		if err := os.WriteFile(file, payload, 0o644); err != nil {
			t.Fatalf("failed to write %s: %v", file, err)
		}
	}
	if err := os.WriteFile(legacy, payload, 0o644); err != nil {
		t.Fatalf("failed to write legacy file: %v", err)
	}
	if err := os.WriteFile(hrqYml, payload, 0o644); err != nil {
		t.Fatalf("failed to write hrq.yml file: %v", err)
	}

	oldwd, _ := os.Getwd()
	if err := os.Chdir(td); err != nil {
		t.Fatalf("failed to chdir: %v", err)
	}
	defer func() { _ = os.Chdir(oldwd) }()

	got := findSuites()
	want := map[string]struct{}{
		"testdata/suite.hrq.yaml":      {},
		"testdata/sub/nested.hrq.yaml": {},
	}

	if len(got) != len(want) {
		t.Fatalf("findSuites() length = %d, want %d; got=%v", len(got), len(want), got)
	}
	for _, p := range got {
		if _, ok := want[p]; !ok {
			t.Fatalf("unexpected suite path %q", p)
		}
	}
	for w := range want {
		found := false
		for _, p := range got {
			if p == w {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("expected path %q not returned", w)
		}
	}
}
