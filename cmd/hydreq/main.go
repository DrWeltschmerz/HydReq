package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"strings"
	"time"

	bru "github.com/DrWeltschmerz/HydReq/internal/adapters/bruno"
	har "github.com/DrWeltschmerz/HydReq/internal/adapters/har"
	in "github.com/DrWeltschmerz/HydReq/internal/adapters/insomnia"
	oai "github.com/DrWeltschmerz/HydReq/internal/adapters/oapi"
	pm "github.com/DrWeltschmerz/HydReq/internal/adapters/postman"
	"github.com/DrWeltschmerz/HydReq/internal/report"
	"github.com/DrWeltschmerz/HydReq/internal/runner"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
	gui "github.com/DrWeltschmerz/HydReq/internal/webui"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func main() {
	var rootCmd = &cobra.Command{Use: "hydreq", Short: "HydReq (Hydra Request) - Lightweight API test runner"}
	// Avoid printing usage/help on runtime errors; we'll print concise messages ourselves.
	rootCmd.SilenceUsage = true
	rootCmd.SilenceErrors = true

	var file string
	var verbose bool
	var tags string
	var workers int
	var defaultTimeoutMs int
	var jsonReport string
	var junitReport string
	var reportDir string
	var htmlReport string
	var output string

	runCmd := &cobra.Command{
		Use:   "run",
		Short: "Run a YAML suite",
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.SilenceUsage = true
			// Keep CLI output minimal and focused
			s, err := runner.LoadSuite(file)
			if err != nil {
				return fmt.Errorf("load suite: %w", err)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()
			var tagList []string
			if tags != "" {
				tagList = strings.Split(tags, ",")
			}
			// capture per-test results via callback
			cases := make([]report.TestCase, 0, 64)
			sum, err := runner.RunSuite(ctx, s, runner.Options{Verbose: verbose, Tags: tagList, Workers: workers, DefaultTimeoutMs: defaultTimeoutMs, OnResult: func(tr runner.TestResult) {
				cases = append(cases, report.TestCase{Name: tr.Name, Stage: tr.Stage, Tags: tr.Tags, Status: tr.Status, DurationMs: tr.DurationMs, Messages: tr.Messages})
			}})
			// Console output format
			if output == "json" {
				rs := report.FromRunner(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
				rep := report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases}
				enc := json.NewEncoder(os.Stdout)
				enc.SetIndent("", "  ")
				_ = enc.Encode(rep)
			} else {
				ui.Summary(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
			}
			rs := report.FromRunner(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
			br := report.BatchReport{RunAt: time.Now(), Summary: rs, Suites: []report.DetailedReport{{Suite: s.Name, Summary: rs, TestCases: cases}}}
			// If reportDir is set and no explicit report files provided, generate both with timestamped names
			// If reportDir is set and no explicit report files provided, generate all with timestamped names
			if reportDir != "" && jsonReport == "" && junitReport == "" && htmlReport == "" {
				ts := time.Now().Format("20060102-150405")
				base := sanitizeFilename(s.Name)
				jsonReport = fmt.Sprintf("%s/%s-%s.json", reportDir, base, ts)
				junitReport = fmt.Sprintf("%s/%s-%s.xml", reportDir, base, ts)
				// ensure directory exists
				if mkerr := os.MkdirAll(reportDir, 0o755); mkerr != nil {
					fmt.Fprintf(os.Stderr, "report dir error: %v\n", mkerr)
				}
				htmlReport = fmt.Sprintf("%s/%s-%s.html", reportDir, base, ts)
			}
			if jsonReport != "" {
				if len(cases) > 0 {
					_ = report.WriteJSONDetailed(jsonReport, report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
				} else {
					if werr := report.WriteJSONSummary(jsonReport, rs); werr != nil {
						fmt.Fprintf(os.Stderr, "report json error: %v\n", werr)
					}
				}
			}
			if junitReport != "" {
				if len(cases) > 0 {
					if werr := report.WriteJUnitDetailed(junitReport, s.Name, rs, cases); werr != nil {
						fmt.Fprintf(os.Stderr, "report junit error: %v\n", werr)
					}
				} else {
					if werr := report.WriteJUnitSummary(junitReport, rs, s.Name); werr != nil {
						fmt.Fprintf(os.Stderr, "report junit error: %v\n", werr)
					}
				}
			}
			if htmlReport != "" {
				if len(cases) > 0 {
					_ = report.WriteHTMLDetailed(htmlReport, report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
				} else {
					_ = report.WriteHTMLDetailed(htmlReport, report.DetailedReport{Suite: s.Name, Summary: rs})
				}
			}
			// If report-dir was used (inferred via auto-populated report paths), also emit run-level summaries alongside
			if reportDir != "" {
				// derive a consistent run-<ts> base from one of the generated filenames
				ts := time.Now().Format("20060102-150405")
				base := fmt.Sprintf("%s/run-%s", reportDir, ts)
				_ = report.WriteJSONBatch(base+".json", br)
				_ = report.WriteJUnitBatchSummary(base+".xml", rs)
				_ = report.WriteHTMLBatch(base+".html", br)
			}
			// Treat test failures as exit code 1 without printing cobra usage/help
			if err != nil {
				if sum.Failed > 0 {
					os.Exit(1)
					return nil
				}
				return err
			}
			if sum.Failed > 0 {
				os.Exit(1)
				return nil
			}
			return nil
		},
	}
	runCmd.Flags().StringVarP(&file, "file", "f", "testdata/example.yaml", "Path to YAML test suite")
	runCmd.Flags().BoolVarP(&verbose, "verbose", "v", false, "Verbose output")
	runCmd.Flags().StringVar(&tags, "tags", "", "Comma-separated tag filter (any match)")
	runCmd.Flags().IntVar(&workers, "workers", 4, "Number of concurrent workers per stage")
	runCmd.Flags().IntVar(&defaultTimeoutMs, "default-timeout-ms", 30000, "Default per-request timeout when test.timeoutMs is not set")
	runCmd.Flags().StringVar(&jsonReport, "report-json", "", "Write JSON summary to file path")
	runCmd.Flags().StringVar(&junitReport, "report-junit", "", "Write JUnit XML summary to file path")
	runCmd.Flags().StringVar(&reportDir, "report-dir", "", "If set and no explicit report paths provided, write JSON, JUnit and HTML to this directory using suite name and timestamp")
	runCmd.Flags().StringVar(&htmlReport, "report-html", "", "Write HTML detailed report to file path")
	runCmd.Flags().StringVar(&output, "output", "summary", "Console output: summary|json")
	rootCmd.AddCommand(runCmd)

	// import command and subcommands
	var importCmd = &cobra.Command{Use: "import", Short: "Import external collections to a YAML suite"}
	var outPath string
	var importPostman = &cobra.Command{Use: "postman <file>", Short: "Import Postman collection (v2.1 JSON)", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := pm.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}
		y, err := yaml.Marshal(s)
		if err != nil {
			return err
		}
		if outPath == "" {
			fmt.Print(string(y))
			return nil
		}
		return ioutil.WriteFile(outPath, y, 0644)
	}}
	importPostman.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	var importInsomnia = &cobra.Command{Use: "insomnia <file>", Short: "Import Insomnia export JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := in.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}
		y, err := yaml.Marshal(s)
		if err != nil {
			return err
		}
		if outPath == "" {
			fmt.Print(string(y))
			return nil
		}
		return ioutil.WriteFile(outPath, y, 0644)
	}}
	importInsomnia.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	var importHAR = &cobra.Command{Use: "har <file>", Short: "Import HAR (HTTP Archive) JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := har.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}
		y, err := yaml.Marshal(s)
		if err != nil {
			return err
		}
		if outPath == "" {
			fmt.Print(string(y))
			return nil
		}
		return ioutil.WriteFile(outPath, y, 0644)
	}}
	importHAR.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	var importOAPI = &cobra.Command{Use: "openapi <file>", Short: "Import OpenAPI (3.x) spec into a basic suite", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := oai.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}
		y, err := yaml.Marshal(s)
		if err != nil {
			return err
		}
		if outPath == "" {
			fmt.Print(string(y))
			return nil
		}
		return ioutil.WriteFile(outPath, y, 0644)
	}}
	importOAPI.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	var importBruno = &cobra.Command{Use: "bruno <file>", Short: "Import minimal Bruno export JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := bru.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}
		y, err := yaml.Marshal(s)
		if err != nil {
			return err
		}
		if outPath == "" {
			fmt.Print(string(y))
			return nil
		}
		return ioutil.WriteFile(outPath, y, 0644)
	}}
	importBruno.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	importCmd.AddCommand(importPostman, importInsomnia, importHAR, importOAPI, importBruno)
	rootCmd.AddCommand(importCmd)

	// GUI command
	var guiCmd = &cobra.Command{Use: "gui", Short: "Launch browser-based GUI", RunE: func(cmd *cobra.Command, args []string) error {
		return gui.Run("127.0.0.1:8787", true)
	}}
	rootCmd.AddCommand(guiCmd)

	// Default to GUI when no args; TUI remains available via subcommand
	if len(os.Args) == 1 {
		if err := gui.Run("127.0.0.1:8787", true); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// sanitizeFilename makes a safe-ish file base name from a suite name
func sanitizeFilename(s string) string {
	if s == "" {
		return "suite"
	}
	// replace path separators and spaces; drop other problematic chars
	repl := strings.NewReplacer("/", "-", "\\", "-", " ", "-")
	s = repl.Replace(s)
	// keep alnum, dash, underscore, dot
	b := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b = append(b, r)
		} else {
			b = append(b, '-')
		}
	}
	// collapse multiple dashes
	out := make([]rune, 0, len(b))
	var lastDash bool
	for _, r := range b {
		if r == '-' {
			if lastDash {
				continue
			}
			lastDash = true
		} else {
			lastDash = false
		}
		out = append(out, r)
	}
	if len(out) == 0 {
		return "suite"
	}
	return string(out)
}
