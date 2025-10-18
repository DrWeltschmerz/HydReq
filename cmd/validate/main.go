package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	valfmt "github.com/DrWeltschmerz/HydReq/internal/validate"
	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"
	kyaml "sigs.k8s.io/yaml"
)

func main() {
	var (
		dir    string
		schema string
		quiet  bool
	)
	flag.StringVar(&dir, "dir", "testdata", "Directory to scan for HydReq suites (*.hrq.yaml)")
	flag.StringVar(&schema, "schema", "schemas/suite.schema.json", "Path to JSON schema file")
	flag.BoolVar(&quiet, "quiet", false, "Only print failures; suppress per-file PASS lines")
	flag.Parse()

	absSchema, err := filepath.Abs(schema)
	if err != nil {
		fmt.Fprintf(os.Stderr, "schema path error: %v\n", err)
		os.Exit(2)
	}
	schemaURL := valfmt.PathToFileURL(absSchema)

	sch, err := jsonschema.Compile(schemaURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "compile schema failed: %v\n", err)
		os.Exit(2)
	}

	files, err := collectSuiteFiles(dir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "walk error: %v\n", err)
		os.Exit(2)
	}

	if len(files) == 0 {
		fmt.Println("no HydReq suites found to validate")
		return
	}

	var failed int
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			fmt.Fprintf(os.Stderr, "READ  %s: %v\n", f, err)
			failed++
			continue
		}
		// Convert YAML to JSON bytes
		jsonBytes, err := kyaml.YAMLToJSON(data)
		if err != nil {
			fmt.Fprintf(os.Stderr, "YAML->JSON %s: %v\n", f, err)
			failed++
			continue
		}
		var v interface{}
		if err := json.Unmarshal(jsonBytes, &v); err != nil {
			fmt.Fprintf(os.Stderr, "JSON parse %s: %v\n", f, err)
			failed++
			continue
		}
		if err := sch.Validate(v); err != nil {
			fmt.Fprintf(os.Stderr, "FAIL  %s\n  %v\n", f, err)
			failed++
		} else if !quiet {
			fmt.Printf("PASS  %s\n", f)
		}
	}

	if failed > 0 {
		fmt.Fprintf(os.Stderr, "\n%d file(s) failed schema validation\n", failed)
		os.Exit(1)
	}
}

func collectSuiteFiles(dir string) ([]string, error) {
	var files []string
	// Collect YAML files recursively, skipping testdata/specs and backups
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if strings.EqualFold(info.Name(), "specs") {
				return filepath.SkipDir
			}
			return nil
		}
		lower := strings.ToLower(info.Name())
		if strings.Contains(lower, ".bak") {
			return nil
		}
		if strings.HasSuffix(lower, ".hrq.yaml") {
			if data, err := os.ReadFile(path); err == nil {
				if jsonBytes, err := kyaml.YAMLToJSON(data); err == nil {
					var v map[string]interface{}
					if err := json.Unmarshal(jsonBytes, &v); err == nil {
						if _, hasName := v["name"]; hasName {
							if _, hasBaseURL := v["baseUrl"]; hasBaseURL {
								if _, hasTests := v["tests"]; hasTests {
									files = append(files, path)
								}
							}
						}
					}
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}

// no custom reader required
