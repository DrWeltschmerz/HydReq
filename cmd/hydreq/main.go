package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	bru "github.com/DrWeltschmerz/HydReq/internal/adapters/bruno"
	har "github.com/DrWeltschmerz/HydReq/internal/adapters/har"
	in "github.com/DrWeltschmerz/HydReq/internal/adapters/insomnia"
	nm "github.com/DrWeltschmerz/HydReq/internal/adapters/newman"
	oai "github.com/DrWeltschmerz/HydReq/internal/adapters/oapi"
	pm "github.com/DrWeltschmerz/HydReq/internal/adapters/postman"
	rc "github.com/DrWeltschmerz/HydReq/internal/adapters/restclient"
	"github.com/DrWeltschmerz/HydReq/internal/report"
	"github.com/DrWeltschmerz/HydReq/internal/runner"
	"github.com/DrWeltschmerz/HydReq/internal/ui"
	valfmt "github.com/DrWeltschmerz/HydReq/internal/validate"
	gui "github.com/DrWeltschmerz/HydReq/internal/webui"
	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
	kyaml "sigs.k8s.io/yaml"
)

func parsePostmanEnvironment(data []byte) (map[string]string, error) {
	var env struct {
		Values []struct {
			Key     string `json:"key"`
			Value   string `json:"value"`
			Enabled *bool  `json:"enabled"`
		} `json:"values"`
	}

	if err := json.Unmarshal(data, &env); err != nil {
		return nil, err
	}

	vars := make(map[string]string)
	for _, v := range env.Values {
		if enabled := v.Enabled; enabled == nil || *enabled {
			vars[v.Key] = v.Value
		}
	}
	return vars, nil
}

func main() {
	// sentinel error to distinguish load failures from runtime failures
	var errLoadSuite = errors.New("suite load error")

	var verbose bool
	var file string
	var tags string
	var workers int
	var defaultTimeoutMs int
	var jsonReport string
	var junitReport string
	var reportDir string
	var htmlReport string
	var output string

	var rootCmd = &cobra.Command{Use: "hydreq", Short: "HydReq (Hydra Request) - Lightweight API test runner"}
	// Avoid printing usage/help on runtime errors; we'll print concise messages ourselves.
	rootCmd.SilenceUsage = true
	rootCmd.SilenceErrors = true
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose output")

	runCmd := &cobra.Command{
		Use:   "run",
		Short: "Run a YAML suite",
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.SilenceUsage = true
			// Keep CLI output minimal and focused
			// Unified run timestamp for all artifacts in this invocation
			runTS := time.Now().Format("20060102-150405")
			// Optional: compile JSON Schema if present, used to annotate not-run items
			var compiledSchema *jsonschema.Schema
			if _, err := os.Stat("schemas/suite.schema.json"); err == nil {
				if abs, aerr := filepath.Abs("schemas/suite.schema.json"); aerr == nil {
					if sch, cerr := jsonschema.Compile(valfmt.PathToFileURL(abs)); cerr == nil {
						compiledSchema = sch
					}
				}
			}
			var tagList []string
			if tags != "" {
				tagList = strings.Split(tags, ",")
			}
			// Helper to run a single suite path
			runOne := func(suitePath string, br *report.BatchReport) (sumFailed int, runErr error) {
				s, err := runner.LoadSuite(suitePath)
				if err != nil {
					return 0, fmt.Errorf("%w: %s: %v", errLoadSuite, suitePath, err)
				}
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
				defer cancel()
				cases := make([]report.TestCase, 0, 64)
				// Print header above tests in human mode
				if output != "json" {
					ui.SuiteHeader(s.Name)
				}
				sum, err := runner.RunSuite(ctx, s, runner.Options{Verbose: verbose, Tags: tagList, Workers: workers, DefaultTimeoutMs: defaultTimeoutMs, OnResult: func(tr runner.TestResult) {
					cases = append(cases, report.TestCase{Name: tr.Name, Stage: tr.Stage, Tags: tr.Tags, Status: tr.Status, DurationMs: tr.DurationMs, Messages: tr.Messages})
				}})
				// If suite is not runnable (e.g., missing baseUrl), don't print or emit artifacts/summary
				if err != nil && errors.Is(err, runner.ErrSuiteNotRunnable) {
					return 0, fmt.Errorf("%w: %s: %v", errLoadSuite, suitePath, err)
				}
				rs := report.FromRunner(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
				if output == "json" {
					enc := json.NewEncoder(os.Stdout)
					enc.SetIndent("", "  ")
					_ = enc.Encode(report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
				} else {
					ui.Summary(sum.Total, sum.Passed, sum.Failed, sum.Skipped, sum.Duration)
				}
				// Collect into batch
				if br != nil {
					br.Suites = append(br.Suites, report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
					br.Summary.Total += rs.Total
					br.Summary.Passed += rs.Passed
					br.Summary.Failed += rs.Failed
					br.Summary.Skipped += rs.Skipped
					br.Summary.Duration += rs.Duration
				}
				// Per-suite artifacts when using report-dir and no explicit report paths
				if reportDir != "" && jsonReport == "" && junitReport == "" && htmlReport == "" {
					if mkerr := os.MkdirAll(reportDir, 0o755); mkerr != nil {
						fmt.Fprintf(os.Stderr, "report dir error: %v\n", mkerr)
					}
					base := fmt.Sprintf("%s/%s-%s", reportDir, sanitizeFilename(s.Name), runTS)
					if len(cases) > 0 {
						_ = report.WriteJSONDetailed(base+".json", report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
					} else {
						_ = report.WriteJSONSummary(base+".json", rs)
					}
					_ = report.WriteJUnitDetailed(base+".xml", s.Name, rs, cases)
					_ = report.WriteHTMLDetailed(base+".html", report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
				} else {
					// Respect explicit report paths for single-suite mode only
					if jsonReport != "" {
						if len(cases) > 0 {
							_ = report.WriteJSONDetailed(jsonReport, report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
						} else {
							_ = report.WriteJSONSummary(jsonReport, rs)
						}
					}
					if junitReport != "" {
						_ = report.WriteJUnitDetailed(junitReport, s.Name, rs, cases)
					}
					if htmlReport != "" {
						_ = report.WriteHTMLDetailed(htmlReport, report.DetailedReport{Suite: s.Name, Summary: rs, TestCases: cases})
					}
				}
				if err != nil {
					// If suite is not runnable (e.g., missing baseUrl), wrap like a load error so callers can classify
					if errors.Is(err, runner.ErrSuiteNotRunnable) {
						return sum.Failed, fmt.Errorf("%w: %s: %v", errLoadSuite, suitePath, err)
					}
					return sum.Failed, err
				}
				return sum.Failed, nil
			}

			// Determine whether to run one or all suites
			failedLoads := make([]string, 0, 8)
			if strings.TrimSpace(file) == "" {
				// Discover suites in testdata/*.yaml
				paths, globErr := filepath.Glob("testdata/*.yaml")
				if globErr != nil {
					return globErr
				}
				if len(paths) == 0 {
					return fmt.Errorf("no suites found in testdata/*.yaml; specify -f to run a file")
				}
				br := report.BatchReport{RunAt: time.Now()}
				var totalFailed int
				for i, p := range paths {
					if i > 0 && output != "json" {
						ui.SuiteSeparator()
					}
					failed, err := runOne(p, &br)
					if err != nil {
						if errors.Is(err, errLoadSuite) {
							failedLoads = append(failedLoads, p)
							// Try to validate for a more actionable message
							var vmsg string
							if compiledSchema != nil {
								if data, rerr := os.ReadFile(p); rerr == nil {
									if jb, jerr := kyaml.YAMLToJSON(data); jerr == nil {
										var v any
										if jderr := json.Unmarshal(jb, &v); jderr == nil {
											if verr := compiledSchema.Validate(v); verr != nil {
												vmsg = valfmt.FormatValidationError(data, verr)
											}
										}
									}
								}
							}
							br.NotRun = append(br.NotRun, report.NotRunInfo{Path: p, Error: err.Error(), ValidationError: vmsg})
							if output != "json" {
								// Pretty-print load error: bold red prefix up to first colon
								emsg := err.Error()
								if idx := strings.Index(emsg, ": "); idx > 0 {
									ui.FailWithBoldPrefix(emsg[:idx], "%s", strings.TrimSpace(emsg[idx+1:]))
								} else {
									ui.Failf("%v", err)
								}
							} else {
								fmt.Fprintf(os.Stderr, "load suite %s: %v\n", p, err)
							}
						} else {
							// Runtime error (e.g., preSuite failure). Results were still collected into batch.
							if output != "json" {
								ui.Failf("run error: %v", err)
							} else {
								fmt.Fprintf(os.Stderr, "run error for %s: %v\n", p, err)
							}
						}
					}
					totalFailed += failed
				}
				// Emit batch/run-level artifacts if requested
				if reportDir != "" {
					base := fmt.Sprintf("%s/run-%s", reportDir, runTS)
					_ = report.WriteJSONBatch(base+".json", br)
					_ = report.WriteJUnitBatchSummary(base+".xml", br.Summary)
					_ = report.WriteHTMLBatch(base+".html", br)
				}
				if len(failedLoads) > 0 && output != "json" {
					ui.SuiteSeparator()
					ui.Failf("%d suite(s) failed to load:", len(failedLoads))
					for _, fp := range failedLoads {
						ui.Detail(fp)
					}
					if path := os.Getenv("GITHUB_STEP_SUMMARY"); path != "" {
						_ = appendSummary(path, failedLoads)
					}
				}
				if totalFailed > 0 || len(failedLoads) > 0 {
					// Exit code 2 when only load failures occurred; otherwise 1
					if totalFailed == 0 && len(failedLoads) > 0 {
						os.Exit(2)
					} else {
						os.Exit(1)
					}
					return nil
				}
				return nil
			}

			// Single-suite mode
			brSingle := report.BatchReport{RunAt: time.Now()}
			failed, err := runOne(file, &brSingle)
			if reportDir != "" {
				// Emit batch artifacts reflecting the single suite results, using the same runTS
				base := fmt.Sprintf("%s/run-%s", reportDir, runTS)
				_ = report.WriteJSONBatch(base+".json", brSingle)
				_ = report.WriteJUnitBatchSummary(base+".xml", brSingle.Summary)
				_ = report.WriteHTMLBatch(base+".html", brSingle)
			}
			if err != nil {
				if output != "json" {
					// Pretty-print single-suite load error
					emsg := err.Error()
					if idx := strings.Index(emsg, ": "); idx > 0 {
						ui.FailWithBoldPrefix(emsg[:idx], "%s", strings.TrimSpace(emsg[idx+1:]))
					} else {
						ui.Failf("%v", err)
					}
				} else {
					if errors.Is(err, errLoadSuite) {
						fmt.Fprintf(os.Stderr, "load suite %s: %v\n", file, err)
					} else {
						fmt.Fprintf(os.Stderr, "run error for %s: %v\n", file, err)
					}
				}
				// Exit code: 2 for load error, 1 for runtime error
				if errors.Is(err, errLoadSuite) {
					os.Exit(2)
					return nil
				}
				os.Exit(1)
				return nil
			}
			if failed > 0 {
				os.Exit(1)
				return nil
			}
			return nil
		},
	}
	runCmd.Flags().StringVarP(&file, "file", "f", "", "Path to YAML test suite (omit to run all suites in testdata)")
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
	var envFile string
	var noScripts bool
	var flatFolders bool
	var baseURL string
	var skipAuth bool

	var importPostman = &cobra.Command{Use: "postman <file>", Short: "Import Postman collection (v2.1 JSON)", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}

		// Load environment variables if specified
		envVars := make(map[string]string)
		if envFile != "" {
			envData, err := os.ReadFile(envFile)
			if err != nil {
				return fmt.Errorf("failed to read environment file: %w", err)
			}
			envVars, err = parsePostmanEnvironment(envData)
			if err != nil {
				return fmt.Errorf("failed to parse environment file: %w", err)
			}
		}

		s, err := pm.Convert(strings.NewReader(string(b)), envVars)
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from Postman collection\n", len(s.Tests))
			if len(s.Variables) > 0 {
				fmt.Fprintf(os.Stderr, "Found %d variables\n", len(s.Variables))
			}
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
	importPostman.Flags().StringVarP(&envFile, "env", "e", "", "Postman environment file to merge variables from")
	importPostman.Flags().BoolVar(&noScripts, "no-scripts", false, "Skip conversion of pre/post request scripts")
	importPostman.Flags().BoolVar(&flatFolders, "flat", false, "Flatten folder structure into simple test names")
	importPostman.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")
	importPostman.Flags().BoolVar(&skipAuth, "skip-auth", false, "Skip conversion of authentication settings")

	var importInsomnia = &cobra.Command{Use: "insomnia <file>", Short: "Import Insomnia export JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := in.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from Insomnia export\n", len(s.Tests))
			if len(s.Variables) > 0 {
				fmt.Fprintf(os.Stderr, "Found %d variables\n", len(s.Variables))
			}
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
	importInsomnia.Flags().BoolVar(&noScripts, "no-scripts", false, "Skip conversion of pre/post request scripts")
	importInsomnia.Flags().BoolVar(&flatFolders, "flat", false, "Flatten folder structure into simple test names")
	importInsomnia.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")
	importInsomnia.Flags().BoolVar(&skipAuth, "skip-auth", false, "Skip conversion of authentication settings")

	var importHAR = &cobra.Command{Use: "har <file>", Short: "Import HAR (HTTP Archive) JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := har.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from HAR file\n", len(s.Tests))
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
	importHAR.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")

	var importOAPI = &cobra.Command{Use: "openapi <file>", Short: "Import OpenAPI (3.x) or Swagger (2.0) spec into a basic suite", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := oai.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from OpenAPI spec\n", len(s.Tests))
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
	importOAPI.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")

	var importBruno = &cobra.Command{Use: "bruno <file>", Short: "Import minimal Bruno export JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := bru.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from Bruno collection\n", len(s.Tests))
			if len(s.Variables) > 0 {
				fmt.Fprintf(os.Stderr, "Found %d variables\n", len(s.Variables))
			}
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
	importBruno.Flags().BoolVar(&noScripts, "no-scripts", false, "Skip conversion of pre/post request scripts")
	importBruno.Flags().BoolVar(&flatFolders, "flat", false, "Flatten folder structure into simple test names")
	importBruno.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")
	importBruno.Flags().BoolVar(&skipAuth, "skip-auth", false, "Skip conversion of authentication settings")

	var importRestClient = &cobra.Command{Use: "restclient <file>", Short: "Import VS Code REST Client .http file", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}
		s, err := rc.Convert(strings.NewReader(string(b)))
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from REST Client file\n", len(s.Tests))
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
	importRestClient.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")
	importRestClient.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")

	var importNewman = &cobra.Command{Use: "newman <file>", Short: "Import Newman (Postman CLI) collection JSON", Args: cobra.ExactArgs(1), RunE: func(cmd *cobra.Command, args []string) error {
		b, err := os.ReadFile(args[0])
		if err != nil {
			return err
		}

		// Load environment variables if specified
		envVars := make(map[string]string)
		if envFile != "" {
			envData, err := os.ReadFile(envFile)
			if err != nil {
				return fmt.Errorf("failed to read environment file: %w", err)
			}
			envVars, err = parsePostmanEnvironment(envData)
			if err != nil {
				return fmt.Errorf("failed to parse environment file: %w", err)
			}
		}

		s, err := nm.Convert(strings.NewReader(string(b)), envVars)
		if err != nil {
			return err
		}

		// Apply CLI-level customizations
		if baseURL != "" {
			if verbose {
				fmt.Fprintf(os.Stderr, "Overriding base URL to: %s\n", baseURL)
			}
			s.BaseURL = baseURL
		}

		if verbose {
			fmt.Fprintf(os.Stderr, "Imported %d tests from Newman collection\n", len(s.Tests))
			if len(s.Variables) > 0 {
				fmt.Fprintf(os.Stderr, "Found %d variables\n", len(s.Variables))
			}
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
	importNewman.Flags().StringVarP(&outPath, "out", "o", "", "Output file (defaults to stdout)")
	importNewman.Flags().StringVarP(&envFile, "env", "e", "", "Postman environment file to merge variables from")
	importNewman.Flags().BoolVar(&noScripts, "no-scripts", false, "Skip conversion of pre/post request scripts")
	importNewman.Flags().BoolVar(&flatFolders, "flat", false, "Flatten folder structure into simple test names")
	importNewman.Flags().StringVar(&baseURL, "base-url", "", "Override base URL for all requests")
	importNewman.Flags().BoolVar(&skipAuth, "skip-auth", false, "Skip conversion of authentication settings")

	importCmd.AddCommand(importPostman, importInsomnia, importHAR, importOAPI, importBruno, importRestClient, importNewman)
	rootCmd.AddCommand(importCmd)

	// GUI command
	var detach bool
	var guiCmd = &cobra.Command{Use: "gui", Short: "Launch browser-based GUI", RunE: func(cmd *cobra.Command, args []string) error {
		if detach {
			// For true detachment, fork the process
			if os.Getppid() == 1 {
				// Already a daemon, just run
				return gui.Run("localhost:8787", true)
			}
			// Fork and exit parent
			args := os.Args
			for i, arg := range args {
				if arg == "--detach" || arg == "-d" {
					args = append(args[:i], args[i+1:]...)
					break
				}
			}
			cmd := exec.Command(args[0], args[1:]...)
			cmd.Stdout = nil
			cmd.Stderr = nil
			cmd.Stdin = nil
			if err := cmd.Start(); err != nil {
				return fmt.Errorf("failed to start detached process: %w", err)
			}
			fmt.Printf("HydReq GUI started in background (PID: %d)\n", cmd.Process.Pid)
			os.Exit(0)
			return nil
		}
		return gui.Run("localhost:8787", true)
	}}
	guiCmd.Flags().BoolVarP(&detach, "detach", "d", false, "Run GUI server in background")
	rootCmd.AddCommand(guiCmd)

	// Default to GUI when no args; TUI remains available via subcommand
	if len(os.Args) == 1 {
		if err := gui.Run("localhost:8787", true); err != nil {
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

// appendSummary appends a small markdown section to the GitHub Actions step summary file
// to surface suites that failed to load.
func appendSummary(path string, failedLoads []string) error {
	if len(failedLoads) == 0 {
		return nil
	}
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	b := &strings.Builder{}
	fmt.Fprintln(b, "\n### Suites failed to load")
	for _, fp := range failedLoads {
		fmt.Fprintf(b, "- %s\n", fp)
	}
	_, err = f.WriteString(b.String())
	return err
}
