package runner

import (
	"context"
	"testing"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// helper to collect results
type collector struct{ results []TestResult }

func (c *collector) onResult(tr TestResult) { c.results = append(c.results, tr) }

// Test that legacy path (no dependsOn) emits skip reasons consistently
func TestRunSuite_Legacy_SkipMessages(t *testing.T) {
	tests := []struct {
		name     string
		suite    models.Suite
		opts     Options
		wantMsgs map[string]string // test name -> expected single message
	}{
		{
			name: "tags filter emits message",
			suite: models.Suite{Tests: []models.TestCase{
				{Name: "t-tags", Stage: 0, Tags: []string{"smoke"}, Request: models.Request{Method: "GET", URL: "http://127.0.0.1:1"}},
			}},
			opts:     Options{Tags: []string{"regression"}},
			wantMsgs: map[string]string{"t-tags": "filtered by tags"},
		},
		{
			name: "explicit skip emits message",
			suite: models.Suite{Tests: []models.TestCase{
				{Name: "t-skip", Stage: 0, Skip: true, Request: models.Request{Method: "GET", URL: "http://127.0.0.1:1"}},
			}},
			opts:     Options{},
			wantMsgs: map[string]string{"t-skip": "explicit skip"},
		},
		{
			name: "only present filters others and emits message",
			suite: models.Suite{Tests: []models.TestCase{
				// This one is marked only but will also be filtered by tags to avoid any execution
				{Name: "t-only", Stage: 0, Only: true, Tags: []string{"special"}, Request: models.Request{Method: "GET", URL: "http://127.0.0.1:1"}},
				// This one should be skipped because only is present
				{Name: "t-nononly", Stage: 0, Tags: []string{"other"}, Request: models.Request{Method: "GET", URL: "http://127.0.0.1:1"}},
			}},
			opts:     Options{Tags: []string{"nomatch"}},
			wantMsgs: map[string]string{"t-nononly": "filtered by only", "t-only": "filtered by tags"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var c collector
			_, _ = RunSuite(context.Background(), &tt.suite, Options{Tags: tt.opts.Tags, Workers: 1, OnResult: c.onResult})
			if len(c.results) != len(tt.wantMsgs) {
				t.Fatalf("unexpected results len: got=%d want=%d", len(c.results), len(tt.wantMsgs))
			}
			for _, r := range c.results {
				if r.Status != "skipped" {
					t.Fatalf("expected status skipped for %s, got %s", r.Name, r.Status)
				}
				if len(r.Messages) == 0 {
					t.Fatalf("expected message for %s, got none", r.Name)
				}
				exp, ok := tt.wantMsgs[r.Name]
				if !ok {
					t.Fatalf("unexpected test in results: %s", r.Name)
				}
				if r.Messages[0] != exp {
					t.Fatalf("unexpected message for %s: got %q want %q", r.Name, r.Messages[0], exp)
				}
			}
		})
	}
}
