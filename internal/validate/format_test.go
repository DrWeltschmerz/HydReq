package validate

import (
	"net/url"
	"strings"
	"testing"
)

func TestPathToFileURL(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		wantPrefix string
		wantParsed bool
		wantScheme string
	}{
		{
			name:       "Unix absolute path",
			input:      "/home/user/schemas/suite.schema.json",
			wantPrefix: "file:///home/user/schemas/suite.schema.json",
			wantParsed: true,
			wantScheme: "file",
		},
		{
			name:       "Windows path with forward slashes",
			input:      "C:/repo/hydreq/schemas/suite.schema.json",
			wantPrefix: "file:///C:/repo/hydreq/schemas/suite.schema.json",
			wantParsed: true,
			wantScheme: "file",
		},
		{
			name:       "Windows path with backslashes",
			input:      "C:\\repo\\hydreq\\schemas\\suite.schema.json",
			wantPrefix: "file:///C:/repo/hydreq/schemas/suite.schema.json",
			wantParsed: true,
			wantScheme: "file",
		},
		{
			name:       "Windows D drive",
			input:      "D:/projects/test.json",
			wantPrefix: "file:///D:/projects/test.json",
			wantParsed: true,
			wantScheme: "file",
		},
		{
			name:       "Windows path with spaces",
			input:      "C:/Program Files/app/schema.json",
			wantPrefix: "file:///C:/Program Files/app/schema.json",
			wantParsed: true,
			wantScheme: "file",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PathToFileURL(tt.input)

			// Check prefix
			if !strings.HasPrefix(got, tt.wantPrefix) {
				t.Errorf("PathToFileURL() = %v, want prefix %v", got, tt.wantPrefix)
			}

			// Check that it parses as a valid URL
			u, err := url.Parse(got)
			if tt.wantParsed && err != nil {
				t.Errorf("PathToFileURL() produced unparseable URL: %v, error: %v", got, err)
			}

			// Check scheme
			if tt.wantParsed && u.Scheme != tt.wantScheme {
				t.Errorf("PathToFileURL() scheme = %v, want %v", u.Scheme, tt.wantScheme)
			}
		})
	}
}

func TestPathToFileURL_PreventsBadURLs(t *testing.T) {
	// Test case that was failing in the original issue
	windowsPath := "C:\\repo\\hydreq_0.3.6-beta_windows_amd64\\schemas\\suite.schema.json"
	fileURL := PathToFileURL(windowsPath)

	// This should NOT produce an invalid URL like file://C:\repo\...
	if strings.Contains(fileURL, "\\") {
		t.Errorf("PathToFileURL() still contains backslashes: %v", fileURL)
	}

	// Parse should succeed without "invalid port" error
	u, err := url.Parse(fileURL)
	if err != nil {
		t.Errorf("PathToFileURL() produced invalid URL: %v, error: %v", fileURL, err)
	}

	// Should have file scheme
	if u.Scheme != "file" {
		t.Errorf("PathToFileURL() scheme = %v, want 'file'", u.Scheme)
	}

	// Expected format: file:///C:/repo/...
	expectedPrefix := "file:///C:/repo/"
	if !strings.HasPrefix(fileURL, expectedPrefix) {
		t.Errorf("PathToFileURL() = %v, want prefix %v", fileURL, expectedPrefix)
	}
}
