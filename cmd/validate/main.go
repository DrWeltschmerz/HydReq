package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"
	kyaml "sigs.k8s.io/yaml"
)

func main() {
	var (
		dir    string
		schema string
		quiet  bool
	)
	flag.StringVar(&dir, "dir", "testdata", "Directory to scan for YAML suites")
	flag.StringVar(&schema, "schema", "schemas/suite.schema.json", "Path to JSON schema file")
	flag.BoolVar(&quiet, "quiet", false, "Only print failures; suppress per-file PASS lines")
	flag.Parse()

	absSchema, err := filepath.Abs(schema)
	if err != nil {
		fmt.Fprintf(os.Stderr, "schema path error: %v\n", err)
		os.Exit(2)
	}
	schemaURL := "file://" + absSchema

	sch, err := jsonschema.Compile(schemaURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "compile schema failed: %v\n", err)
		os.Exit(2)
	}

	var files []string
	// Collect YAML files recursively, skipping testdata/specs and backups
	err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			// skip any specs folder
			if strings.EqualFold(info.Name(), "specs") {
				return filepath.SkipDir
			}
			return nil
		}
		name := info.Name()
		lower := strings.ToLower(name)
		if strings.Contains(lower, ".bak") {
			return nil
		}
		if strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml") {
			// Quick check if this looks like a HydReq suite by reading first few lines
			if data, err := os.ReadFile(path); err == nil {
				// Convert to JSON to check structure
				if jsonBytes, err := kyaml.YAMLToJSON(data); err == nil {
					var v map[string]interface{}
					if err := json.Unmarshal(jsonBytes, &v); err == nil {
						// Check for required suite properties
						if _, hasName := v["name"]; hasName {
							if _, hasBaseUrl := v["baseUrl"]; hasBaseUrl {
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
		fmt.Fprintf(os.Stderr, "walk error: %v\n", err)
		os.Exit(2)
	}

	if len(files) == 0 {
		fmt.Println("no YAML files found to validate")
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

// no custom reader required
