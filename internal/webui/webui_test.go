package webui

import (
	"context"
	"encoding/json"
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
	path := "testdata/DOES_NOT_EXIST.yaml"
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
		if containsAll(line, `"type":"error"`, `DOES_NOT_EXIST.yaml`) {
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
