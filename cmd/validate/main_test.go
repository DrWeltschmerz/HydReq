package main

import (
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
)

func TestCollectSuiteFilesFiltersExtensions(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	mustMkdirAll(t, filepath.Join(tdTestdata, "sub"))
	mustMkdirAll(t, filepath.Join(tdTestdata, "specs"))

	validRoot := filepath.Join(tdTestdata, "valid.hrq.yaml")
	validNested := filepath.Join(tdTestdata, "sub", "nested.hrq.yaml")
	legacyYaml := filepath.Join(tdTestdata, "legacy.yaml")
	legacyHrqYml := filepath.Join(tdTestdata, "legacy.hrq.yml")
	specsFile := filepath.Join(tdTestdata, "specs", "skip.hrq.yaml")

	payload := []byte("name: demo\nbaseUrl: http://example.com\ntests: []\n")
	mustWriteFile(t, validRoot, payload)
	mustWriteFile(t, validNested, payload)
	mustWriteFile(t, legacyYaml, payload)
	mustWriteFile(t, legacyHrqYml, payload)
	mustWriteFile(t, specsFile, payload)

	files, err := collectSuiteFiles(td)
	if err != nil {
		t.Fatalf("collectSuiteFiles returned error: %v", err)
	}

	sort.Strings(files)
	want := []string{validRoot, validNested}
	sort.Strings(want)

	if !reflect.DeepEqual(files, want) {
		t.Fatalf("collectSuiteFiles = %v, want %v", files, want)
	}
}

func TestCollectSuiteFilesNoMatches(t *testing.T) {
	td := t.TempDir()
	tdTestdata := filepath.Join(td, "testdata")
	mustMkdirAll(t, tdTestdata)
	mustWriteFile(t, filepath.Join(tdTestdata, "legacy.yaml"), []byte("name: demo\n"))

	files, err := collectSuiteFiles(td)
	if err != nil {
		t.Fatalf("collectSuiteFiles returned error: %v", err)
	}
	if len(files) != 0 {
		t.Fatalf("expected no files, got %v", files)
	}
}

func mustMkdirAll(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(path, 0o755); err != nil {
		t.Fatalf("failed to mkdir %s: %v", path, err)
	}
}

func mustWriteFile(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("failed to write %s: %v", path, err)
	}
}
