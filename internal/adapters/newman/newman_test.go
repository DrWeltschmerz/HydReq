package newman

import (
	"os"
	"testing"
)

func TestConvert(t *testing.T) {
	// Use the same test data as Postman since Newman uses the same format
	file, err := os.Open("../../../testdata/complex-postman.json")
	if err != nil {
		t.Fatalf("Failed to open test file: %v", err)
	}
	defer file.Close()

	suite, err := Convert(file, nil)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	if suite.Name == "" {
		t.Errorf("Expected non-empty suite name")
	}

	if len(suite.Tests) == 0 {
		t.Errorf("Expected at least one test")
	}

	// Basic validation that conversion worked
	for i, test := range suite.Tests {
		if test.Request.Method == "" {
			t.Errorf("Test %d: empty method", i)
		}
		if test.Request.URL == "" {
			t.Errorf("Test %d: empty URL", i)
		}
	}
}

func TestConvertWithEnvironmentVariables(t *testing.T) {
	// Test that Newman properly passes environment variables to Postman converter
	file, err := os.Open("../../../testdata/complex-postman.json")
	if err != nil {
		t.Fatalf("Failed to open test file: %v", err)
	}
	defer file.Close()

	envVars := map[string]string{
		"testEnvVar":  "test-value",
		"overrideVar": "overridden-value",
	}

	suite, err := Convert(file, envVars)
	if err != nil {
		t.Fatalf("Convert failed: %v", err)
	}

	// Check that environment variables were passed through
	if suite.Variables["testEnvVar"] != "test-value" {
		t.Errorf("Expected testEnvVar to be 'test-value', got '%s'", suite.Variables["testEnvVar"])
	}
}
