package restclient

import (
	"bufio"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Convert parses a VS Code REST Client .http file and converts it to a HydReq suite
func Convert(r io.Reader) (*models.Suite, error) {
	scanner := bufio.NewScanner(r)
	suite := &models.Suite{
		Name: "REST Client Import",
	}

	var currentRequest *models.TestCase
	var currentBody strings.Builder
	inBody := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		// Skip empty lines and comments (but not request separators)
		if line == "" || (strings.HasPrefix(line, "#") && line != "###") || strings.HasPrefix(line, "//") {
			continue
		}

		// Check for request separator
		if line == "###" {
			// Save previous request if exists
			if currentRequest != nil {
				if currentBody.Len() > 0 {
					currentRequest.Request.Body = strings.TrimSpace(currentBody.String())
				}
				suite.Tests = append(suite.Tests, *currentRequest)
			}
			// Start new request
			currentRequest = &models.TestCase{}
			currentBody.Reset()
			inBody = false
			continue
		}

		// If we don't have a current request or need to start a new one, check for request line
		if currentRequest == nil || currentRequest.Request.Method == "" {
			if strings.Contains(line, " ") && !isHeaderLine(line) {
				parts := strings.Fields(line)
				if len(parts) >= 2 && isHTTPMethod(parts[0]) {
					if currentRequest != nil && currentRequest.Request.Method != "" {
						// Save the previous request if it exists
						if currentBody.Len() > 0 {
							currentRequest.Request.Body = strings.TrimSpace(currentBody.String())
						}
						suite.Tests = append(suite.Tests, *currentRequest)
					}
					// Start new request
					currentRequest = &models.TestCase{}
					currentRequest.Request.Method = strings.ToUpper(parts[0])
					fullURL := strings.Join(parts[1:], " ")

					// Parse URL and extract query parameters
					if parsedURL, err := url.Parse(fullURL); err == nil {
						// Extract query parameters first
						if len(parsedURL.RawQuery) > 0 {
							currentRequest.Request.Query = make(map[string]string)
							for key, values := range parsedURL.Query() {
								if len(values) > 0 {
									currentRequest.Request.Query[key] = values[0] // Take first value
								}
							}
						}
						// Reconstruct URL without query string
						currentRequest.Request.URL = fmt.Sprintf("%s://%s%s", parsedURL.Scheme, parsedURL.Host, parsedURL.Path)
					} else {
						currentRequest.Request.URL = fullURL
					}

					currentBody.Reset()
					inBody = false
					continue
				}
			}
		}

		// Skip if we still don't have a current request
		if currentRequest == nil {
			continue
		}

		// Parse headers (only when not in body)
		if !inBody && isHeaderLine(line) {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				value := strings.TrimSpace(parts[1])

				// Handle special headers
				switch strings.ToLower(key) {
				case "authorization":
					// For now, just add as a regular header
					// TODO: Could extract bearer tokens to suite-level auth
					if currentRequest.Request.Headers == nil {
						currentRequest.Request.Headers = make(map[string]string)
					}
					currentRequest.Request.Headers[key] = value
				case "content-type":
					// Add Content-Type header
					if currentRequest.Request.Headers == nil {
						currentRequest.Request.Headers = make(map[string]string)
					}
					currentRequest.Request.Headers[key] = value
				default:
					if currentRequest.Request.Headers == nil {
						currentRequest.Request.Headers = make(map[string]string)
					}
					currentRequest.Request.Headers[key] = value
				}
				continue
			}
		}

		// Check if this is the start of a JSON body
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "[") {
			inBody = true
			currentBody.WriteString(line)
			currentBody.WriteString("\n")
			continue
		}

		// Continue building body if we're in one
		if inBody {
			currentBody.WriteString(line)
			currentBody.WriteString("\n")
		}
	}

	// Don't forget the last request
	if currentRequest != nil {
		if currentBody.Len() > 0 {
			currentRequest.Request.Body = strings.TrimSpace(currentBody.String())
		}
		suite.Tests = append(suite.Tests, *currentRequest)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// Generate names for requests that don't have them
	for i := range suite.Tests {
		if suite.Tests[i].Name == "" {
			suite.Tests[i].Name = fmt.Sprintf("%s %s", suite.Tests[i].Request.Method, suite.Tests[i].Request.URL)
		}
	}

	return suite, nil
}

// isHTTPMethod checks if a string is a valid HTTP method
func isHTTPMethod(method string) bool {
	methods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"}
	for _, m := range methods {
		if strings.EqualFold(method, m) {
			return true
		}
	}
	return false
}

// isHeaderLine checks if a line looks like an HTTP header (Key: Value)
func isHeaderLine(line string) bool {
	// Look for pattern: key: value
	colonIndex := strings.Index(line, ":")
	if colonIndex == -1 {
		return false
	}

	// Check if there's a space before the colon (indicating it's not a URL)
	if strings.Contains(line[:colonIndex], " ") {
		return false
	}

	return true
}
