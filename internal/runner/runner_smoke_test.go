package runner

import (
	"context"
	"testing"
	"time"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

func TestRunSuiteEmpty(t *testing.T) {
	s := &models.Suite{Name: "empty", BaseURL: "https://example.com"}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	var results []TestResult
	sum, err := RunSuite(ctx, s, Options{OnResult: func(tr TestResult) { results = append(results, tr) }})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sum.Total != 0 || sum.Failed != 0 {
		t.Fatalf("unexpected summary: %+v", sum)
	}
	if len(results) != 0 {
		t.Fatalf("unexpected results: %+v", results)
	}
}
