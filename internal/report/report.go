package report

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/DrWeltschmerz/HydReq/internal/ui"
)

type Summary struct {
	Total    int           `json:"total"`
	Passed   int           `json:"passed"`
	Failed   int           `json:"failed"`
	Skipped  int           `json:"skipped"`
	Duration time.Duration `json:"duration"`
}

type TestCase struct {
	Name       string   `json:"name"`
	Stage      int      `json:"stage"`
	Tags       []string `json:"tags,omitempty"`
	Status     string   `json:"status"`
	DurationMs int64    `json:"durationMs,omitempty"`
	Messages   []string `json:"messages,omitempty"`
}

type DetailedReport struct {
	Suite     string     `json:"suite"`
	Summary   Summary    `json:"summary"`
	TestCases []TestCase `json:"tests"`
}

// BatchReport represents an aggregated run across multiple suites.
// Suites may be empty when only one suite was executed; the Summary reflects the run totals.
type BatchReport struct {
	RunAt   time.Time        `json:"runAt"`
	Summary Summary          `json:"summary"`
	Suites  []DetailedReport `json:"suites,omitempty"`
	NotRun  []NotRunInfo     `json:"notRun,omitempty"`
}

// NotRunInfo captures suites that were discovered but not executed
// (e.g., failed to load or failed schema validation).
type NotRunInfo struct {
	Path            string `json:"path"`
	Error           string `json:"error,omitempty"`
	ValidationError string `json:"validationError,omitempty"`
}

func WriteJSONSummary(path string, sum Summary) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(sum)
}

func WriteJSONDetailed(path string, rep DetailedReport) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(rep)
}

// Minimal JUnit XML
func WriteJUnitSummary(path string, sum Summary, suiteName string) error {
	xml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="%s" tests="%d" failures="%d" skipped="%d" time="%0.3f">
</testsuite>
`, suiteName, sum.Total, sum.Failed, sum.Skipped, sum.Duration.Seconds())
	return os.WriteFile(path, []byte(xml), 0644)
}

func WriteJUnitDetailed(path string, suite string, sum Summary, tests []TestCase) error {
	b := &strings.Builder{}
	fmt.Fprintf(b, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
	fmt.Fprintf(b, "<testsuite name=\"%s\" tests=\"%d\" failures=\"%d\" skipped=\"%d\" time=\"%0.3f\">\n", suite, sum.Total, sum.Failed, sum.Skipped, sum.Duration.Seconds())
	for _, tc := range tests {
		fmt.Fprintf(b, "  <testcase name=\"%s\" time=\"%0.3f\">\n", xmlEscape(tc.Name), float64(tc.DurationMs)/1000.0)
		switch tc.Status {
		case "skipped":
			fmt.Fprintf(b, "    <skipped/>\n")
		case "failed":
			msg := ""
			if len(tc.Messages) > 0 {
				msg = xmlEscape(strings.Join(tc.Messages, "; "))
			}
			fmt.Fprintf(b, "    <failure message=\"%s\"/>\n", msg)
		}
		fmt.Fprintf(b, "  </testcase>\n")
	}
	fmt.Fprintf(b, "</testsuite>\n")
	return os.WriteFile(path, []byte(b.String()), 0644)
}

func xmlEscape(s string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"\"", "&quot;",
		"<", "&lt;",
		">", "&gt;",
		"'", "&apos;",
	)
	return r.Replace(s)
}

// Adapter from runner.Summary to report.Summary
func FromRunner(total, passed, failed, skipped int, d time.Duration) Summary {
	return Summary{Total: total, Passed: passed, Failed: failed, Skipped: skipped, Duration: d}
}

func PrintToConsole(sum Summary) {
	ui.Summary(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
}

func WriteJSONBatch(path string, br BatchReport) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	return enc.Encode(br)
}

// Minimal JUnit wrapper for batch: we emit a <testsuite name="batch"> with totals only.
func WriteJUnitBatchSummary(path string, sum Summary) error {
	xml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="batch" tests="%d" failures="%d" skipped="%d" time="%0.3f">
</testsuite>
`, sum.Total, sum.Failed, sum.Skipped, sum.Duration.Seconds())
	return os.WriteFile(path, []byte(xml), 0644)
}
