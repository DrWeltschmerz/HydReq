package main

import (
	"context"
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
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

func main() {
	var rootCmd = &cobra.Command{Use: "qa", Short: "Lightweight API test runner"}

	var file string
	var verbose bool
	var tags string
	var workers int
	var defaultTimeoutMs int
	var jsonReport string
	var junitReport string

	runCmd := &cobra.Command{
		Use:   "run",
		Short: "Run a YAML suite",
		RunE: func(cmd *cobra.Command, args []string) error {
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
			ui.Summary(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
			rs := report.FromRunner(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
			if jsonReport != "" {
				// prefer detailed when we have cases captured
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
			if err != nil {
				return err
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
	rootCmd.AddCommand(runCmd)

	// import command
	var importCmd = &cobra.Command{Use: "import", Short: "Import external collections to a YAML suite"}
	var outPath string
	// postman subcommand
	var importPostman = &cobra.Command{
		Use:   "postman <file>",
		Short: "Import Postman collection (v2.1 JSON)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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
		},
	}
	importPostman.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	// insomnia subcommand
	var importInsomnia = &cobra.Command{
		Use:   "insomnia <file>",
		Short: "Import Insomnia export JSON",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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
		},
	}
	importInsomnia.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	// har subcommand
	var importHAR = &cobra.Command{
		Use:   "har <file>",
		Short: "Import HAR (HTTP Archive) JSON",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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
		},
	}
	importHAR.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	// openapi subcommand
	var importOAPI = &cobra.Command{
		Use:   "openapi <file>",
		Short: "Import OpenAPI (3.x) spec into a basic suite",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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
		},
	}
	importOAPI.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	// bruno subcommand (optional/minimal)
	var importBruno = &cobra.Command{
		Use:   "bruno <file>",
		Short: "Import minimal Bruno export JSON",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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
		},
	}
	importBruno.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")

	importCmd.AddCommand(importPostman, importInsomnia, importHAR, importOAPI, importBruno)
	rootCmd.AddCommand(importCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
