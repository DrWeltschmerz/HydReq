package main

import (
	"log"
	"time"

	"github.com/DrWeltschmerz/HydReq/internal/report"
)

func main() {
	rep := report.DetailedReport{
		Suite:   "debug-suite",
		Summary: report.Summary{Total: 3, Passed: 2, Failed: 1, Duration: 9876},
		TestCases: []report.TestCase{
			{Name: "ok-1", Status: "passed", DurationMs: 10},
			{Name: "ok-2", Status: "passed", DurationMs: 20},
			{Name: "bad-thing", Status: "failed", Messages: []string{"boom"}, DurationMs: 50},
		},
	}
	p := "report-debug.html"
	if err := report.WriteHTMLDetailed(p, rep); err != nil {
		log.Fatalf("write report: %v", err)
	}
	log.Printf("wrote %s at %s", p, time.Now().Format(time.RFC3339))
}
