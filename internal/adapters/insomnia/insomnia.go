package insomnia

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/DrWeltschmerz/HydReq/internal/script"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Insomnia v5 export structures
type Export struct {
	Type         string        `json:"type"`
	Name         string        `json:"name,omitempty"`
	Meta         *Meta         `json:"meta,omitempty"`
	Collection   *Collection   `json:"collection,omitempty"`
	Environments []Environment `json:"environments,omitempty"`
	Resources    []Resource    `json:"resources,omitempty"` // for older formats
}

type Meta struct {
	ID       string `json:"id"`
	Created  int64  `json:"created"`
	Modified int64  `json:"modified"`
}

type Collection struct {
	Items []CollectionItem `json:"items"`
}

type CollectionItem struct {
	Type                string           `json:"type"` // http-request, folder
	Name                string           `json:"name"`
	Seq                 int              `json:"seq,omitempty"`
	Meta                *ItemMeta        `json:"meta,omitempty"`
	Request             *Request         `json:"request,omitempty"`
	Items               []CollectionItem `json:"items,omitempty"` // for folders
	Authentication      *Authentication  `json:"authentication,omitempty"`
	Auth                *Authentication  `json:"auth,omitempty"` // alternative field name
	Environment         map[string]any   `json:"environment,omitempty"`
	PreRequestScript    string           `json:"preRequestScript,omitempty"`
	AfterResponseScript string           `json:"afterResponseScript,omitempty"`
}

type ItemMeta struct {
	ID       string `json:"id"`
	Created  int64  `json:"created"`
	Modified int64  `json:"modified"`
}

type Request struct {
	Method         string          `json:"method"`
	URL            string          `json:"url"`
	Headers        []Header        `json:"headers,omitempty"`
	Parameters     []Parameter     `json:"parameters,omitempty"`
	Body           *Body           `json:"body,omitempty"`
	Auth           *Authentication `json:"auth,omitempty"`
	Authentication *Authentication `json:"authentication,omitempty"` // alternative
	Description    string          `json:"description,omitempty"`
}

type Header struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

type Parameter struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

type Body struct {
	MimeType string  `json:"mimeType"`
	Text     string  `json:"text,omitempty"`
	Params   []Param `json:"params,omitempty"`
}

type Param struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Id       string `json:"id,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
}

type Authentication struct {
	Type     string `json:"type"`
	Disabled bool   `json:"disabled,omitempty"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Token    string `json:"token,omitempty"`
	// Add other fields as needed
}

type Environment struct {
	Name              string         `json:"name"`
	Data              map[string]any `json:"data"`
	DataPropertyOrder *PropertyOrder `json:"dataPropertyOrder,omitempty"`
}

type PropertyOrder struct {
	Map map[string][]string `json:"map"`
}

// Legacy resource format (for backward compatibility)
type Resource struct {
	Type    string   `json:"_type"`
	Name    string   `json:"name"`
	Method  string   `json:"method"`
	URL     string   `json:"url"`
	Headers []Header `json:"headers"`
	Body    *Body    `json:"body"`
}

func Convert(r io.Reader) (*models.Suite, error) {
	var exp Export
	if err := json.NewDecoder(r).Decode(&exp); err != nil {
		return nil, err
	}

	var suiteName string
	if exp.Name != "" {
		suiteName = exp.Name
	} else {
		suiteName = "Insomnia Import"
	}
	suite := &models.Suite{Name: suiteName}

	// Handle environments
	if len(exp.Environments) > 0 {
		suite.Variables = make(map[string]string)
		for _, env := range exp.Environments {
			for k, v := range env.Data {
				if str, ok := v.(string); ok {
					suite.Variables[k] = str
				}
			}
		}
	}

	// Handle collection items
	if exp.Collection != nil {
		var walk func(items []CollectionItem, path []string)
		walk = func(items []CollectionItem, path []string) {
			for _, item := range items {
				currentPath := append(path, item.Name)
				if item.Type == "folder" && len(item.Items) > 0 {
					walk(item.Items, currentPath)
					continue
				}
				if item.Type != "http-request" || item.Request == nil {
					continue
				}
				req := item.Request
				headers := map[string]string{}
				for _, h := range req.Headers {
					if !h.Disabled {
						headers[h.Name] = h.Value
					}
				}

				// Add query params to URL
				url := req.URL
				if len(req.Parameters) > 0 {
					var queryParts []string
					for _, p := range req.Parameters {
						if !p.Disabled {
							queryParts = append(queryParts, fmt.Sprintf("%s=%s", p.Name, p.Value))
						}
					}
					if len(queryParts) > 0 {
						url += "?" + strings.Join(queryParts, "&")
					}
				}

				var body any
				if req.Body != nil {
					if req.Body.Text != "" {
						body = req.Body.Text
					} else if len(req.Body.Params) > 0 {
						// Handle form-encoded params
						params := make(map[string]string)
						for _, p := range req.Body.Params {
							if !p.Disabled {
								params[p.Name] = p.Value
							}
						}
						body = params
					}
					if req.Body.MimeType != "" {
						headers["Content-Type"] = req.Body.MimeType
					}
				}

				// Handle auth (check all possible locations)
				var auth *Authentication
				if item.Authentication != nil && !item.Authentication.Disabled {
					auth = item.Authentication
				} else if item.Auth != nil && !item.Auth.Disabled {
					auth = item.Auth
				} else if req.Auth != nil && !req.Auth.Disabled {
					auth = req.Auth
				} else if req.Authentication != nil && !req.Authentication.Disabled {
					auth = req.Authentication
				}
				if auth != nil {
					authHeaders := convertAuthToHeaders(auth)
					for k, v := range authHeaders {
						headers[k] = v
					}
				}

				tc := models.TestCase{
					Name:    strings.Join(currentPath, " > "),
					Request: models.Request{Method: req.Method, URL: url, Headers: headers, Body: body},
					Assert:  models.Assertions{Status: 200},
				}

				// Handle scripts
				if item.PreRequestScript != "" {
					tc.Pre = script.TranslateJSToHook(item.PreRequestScript, "insomnia")
				}
				if item.AfterResponseScript != "" {
					tc.Post = script.TranslateJSToHook(item.AfterResponseScript, "insomnia")
				}

				// Handle item environment
				if len(item.Environment) > 0 {
					tc.Vars = make(map[string]string)
					for k, v := range item.Environment {
						if str, ok := v.(string); ok {
							tc.Vars[k] = str
						}
					}
				}

				suite.Tests = append(suite.Tests, tc)
			}
		}
		walk(exp.Collection.Items, []string{})
	} else {
		// Fallback to legacy resource format
		for _, res := range exp.Resources {
			if res.Type != "request" {
				continue
			}
			headers := map[string]string{}
			for _, h := range res.Headers {
				headers[h.Name] = h.Value
			}
			var body any
			if res.Body != nil && res.Body.Text != "" {
				body = res.Body.Text
			}
			tc := models.TestCase{
				Name:    res.Name,
				Request: models.Request{Method: res.Method, URL: res.URL, Headers: headers, Body: body},
				Assert:  models.Assertions{Status: 200},
			}
			suite.Tests = append(suite.Tests, tc)
		}
	}

	return suite, nil
}

func convertAuthToHeaders(auth *Authentication) map[string]string {
	headers := make(map[string]string)
	if auth == nil || auth.Disabled {
		return headers
	}

	switch auth.Type {
	case "basic":
		if auth.Username != "" || auth.Password != "" {
			// For now, just set a placeholder - in real implementation would base64 encode
			headers["Authorization"] = "Basic " + auth.Username + ":" + auth.Password
		}
	case "bearer":
		if auth.Token != "" {
			headers["Authorization"] = "Bearer " + auth.Token
		}
	}
	return headers
}
