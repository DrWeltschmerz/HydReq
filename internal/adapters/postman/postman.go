package postman

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/DrWeltschmerz/HydReq/internal/script"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Postman v2.1 structures
type Collection struct {
	Info struct {
		Name string `json:"name"`
	} `json:"info"`
	Item     []Item     `json:"item"`
	Variable []Variable `json:"variable,omitempty"`
	Auth     *Auth      `json:"auth,omitempty"`
	Event    []Event    `json:"event,omitempty"`
}

type Item struct {
	Name     string     `json:"name"`
	Request  *Request   `json:"request,omitempty"`
	Item     []Item     `json:"item,omitempty"` // nested items (folders)
	Auth     *Auth      `json:"auth,omitempty"`
	Event    []Event    `json:"event,omitempty"`
	Variable []Variable `json:"variable,omitempty"`
}

type Request struct {
	Method      string      `json:"method"`
	URL         interface{} `json:"url"` // string or UrlObject
	Auth        *Auth       `json:"auth,omitempty"`
	Header      []Header    `json:"header,omitempty"`
	Body        *Body       `json:"body,omitempty"`
	Description string      `json:"description,omitempty"`
}

type Header struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled *bool  `json:"enabled,omitempty"` // defaults to true
}

type Auth struct {
	Type   string      `json:"type"`
	Basic  []AuthParam `json:"basic,omitempty"`
	Bearer []AuthParam `json:"bearer,omitempty"`
	// Add other auth types as needed
}

type AuthParam struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Type  string `json:"type,omitempty"`
}

type Event struct {
	Listen string  `json:"listen"`
	Script *Script `json:"script,omitempty"`
}

type Script struct {
	Type string   `json:"type"`
	Exec []string `json:"exec,omitempty"`
}

type Body struct {
	Mode       string      `json:"mode"`
	Raw        string      `json:"raw,omitempty"`
	Formdata   []FormParam `json:"formdata,omitempty"`
	Urlencoded []FormParam `json:"urlencoded,omitempty"`
	File       *FileSrc    `json:"file,omitempty"`
	Graphql    *Graphql    `json:"graphql,omitempty"`
}

type FormParam struct {
	Key     string   `json:"key"`
	Value   string   `json:"value"`
	Type    string   `json:"type,omitempty"` // text or file
	Src     []string `json:"src,omitempty"`  // for file type
	Enabled *bool    `json:"enabled,omitempty"`
}

type FileSrc struct {
	Src []string `json:"src"`
}

type Graphql struct {
	Query     string `json:"query"`
	Variables string `json:"variables,omitempty"`
}

type Variable struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Type    string `json:"type,omitempty"`
	Enabled *bool  `json:"enabled,omitempty"`
}

type UrlObject struct {
	Raw      string       `json:"raw"`
	Protocol string       `json:"protocol,omitempty"`
	Host     []string     `json:"host,omitempty"`
	Path     []string     `json:"path,omitempty"`
	Query    []QueryParam `json:"query,omitempty"`
	Variable []Variable   `json:"variable,omitempty"`
}

type QueryParam struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled *bool  `json:"enabled,omitempty"`
}

// Convert reads a Postman v2.1 collection and produces a basic Suite with one test per request.
// envVars are merged with collection variables, with environment variables taking precedence.
func Convert(r io.Reader, envVars map[string]string) (*models.Suite, error) {
	var c Collection
	if err := json.NewDecoder(r).Decode(&c); err != nil {
		return nil, err
	}
	suite := &models.Suite{Name: c.Info.Name}

	// Handle collection-level auth
	if c.Auth != nil {
		suite.Auth = convertAuth(c.Auth)
	}

	// Handle collection variables (merge with environment variables)
	suite.Variables = make(map[string]string)

	// First add collection variables
	if len(c.Variable) > 0 {
		for _, v := range c.Variable {
			if enabled := v.Enabled; enabled == nil || *enabled {
				suite.Variables[v.Key] = v.Value
			}
		}
	}

	// Then add/override with environment variables
	for k, v := range envVars {
		suite.Variables[k] = v
	}

	// Handle collection scripts (pre-suite)
	if len(c.Event) > 0 {
		suite.PreSuite = convertEventsToHooks(c.Event, "prerequest")
		suite.PostSuite = convertEventsToHooks(c.Event, "test")
	}

	// Process items recursively
	var walk func(items []Item, path []string)
	walk = func(items []Item, path []string) {
		for _, it := range items {
			currentPath := append(path, it.Name)
			if it.Request == nil && len(it.Item) > 0 {
				// Folder
				walk(it.Item, currentPath)
				continue
			}
			if it.Request == nil {
				continue
			}
			req := it.Request
			url := resolveURLFromPostman(req.URL)
			headers := map[string]string{}
			for _, h := range req.Header {
				if enabled := h.Enabled; enabled == nil || *enabled {
					headers[h.Key] = h.Value
				}
			}
			body := convertBody(req.Body)
			if body != nil && req.Body.Mode == "raw" {
				if _, ok := headers["Content-Type"]; !ok {
					headers["Content-Type"] = "application/json"
				}
			}

			tc := models.TestCase{
				Name:    strings.Join(currentPath, " > "),
				Request: models.Request{Method: req.Method, URL: url, Headers: headers, Body: body},
				Assert:  models.Assertions{Status: 200},
			}

			// Handle request-level auth
			if req.Auth != nil {
				// For now, add as test variables or ignore
				// TODO: better auth handling
			}

			// Handle request scripts
			if len(it.Event) > 0 {
				tc.Pre = convertEventsToHooks(it.Event, "prerequest")
				tc.Post = convertEventsToHooks(it.Event, "test")
			}

			// Handle item variables
			if len(it.Variable) > 0 {
				tc.Vars = make(map[string]string)
				for _, v := range it.Variable {
					if enabled := v.Enabled; enabled == nil || *enabled {
						tc.Vars[v.Key] = v.Value
					}
				}
			}

			suite.Tests = append(suite.Tests, tc)
		}
	}
	walk(c.Item, []string{})
	return suite, nil
}

func resolveURLFromPostman(u interface{}) string {
	switch t := u.(type) {
	case string:
		return t
	case map[string]interface{}:
		if raw, ok := t["raw"].(string); ok {
			return raw
		}
		// Build URL from parts
		var url strings.Builder
		if protocol, ok := t["protocol"].(string); ok {
			url.WriteString(protocol)
			url.WriteString("://")
		}
		if host, ok := t["host"].([]interface{}); ok {
			for i, part := range host {
				if i > 0 {
					url.WriteString(".")
				}
				url.WriteString(fmt.Sprintf("%v", part))
			}
		}
		if path, ok := t["path"].([]interface{}); ok {
			url.WriteString("/")
			for i, part := range path {
				if i > 0 {
					url.WriteString("/")
				}
				url.WriteString(fmt.Sprintf("%v", part))
			}
		}
		if query, ok := t["query"].([]interface{}); ok && len(query) > 0 {
			url.WriteString("?")
			for i, q := range query {
				if i > 0 {
					url.WriteString("&")
				}
				if qm, ok := q.(map[string]interface{}); ok {
					key := fmt.Sprintf("%v", qm["key"])
					value := fmt.Sprintf("%v", qm["value"])
					if enabled, ok := qm["enabled"].(bool); !ok || enabled {
						url.WriteString(key)
						url.WriteString("=")
						url.WriteString(value)
					}
				}
			}
		}
		return url.String()
	default:
		return ""
	}
}

func convertAuth(auth *Auth) *models.Auth {
	if auth == nil {
		return nil
	}

	switch auth.Type {
	case "basic":
		if len(auth.Basic) >= 2 {
			var username, password string
			for _, param := range auth.Basic {
				switch param.Key {
				case "username":
					username = param.Value
				case "password":
					password = param.Value
				}
			}
			if username != "" || password != "" {
				return &models.Auth{
					BasicEnv: fmt.Sprintf("%s:%s", username, password), // Store as env format
				}
			}
		}
	case "bearer":
		if len(auth.Bearer) >= 1 {
			for _, param := range auth.Bearer {
				if param.Key == "token" && param.Value != "" {
					return &models.Auth{
						BearerEnv: param.Value, // Store token directly
					}
				}
			}
		}
	}
	return nil
}

func convertEventsToHooks(events []Event, listenType string) []models.Hook {
	var hooks []models.Hook
	for _, event := range events {
		if event.Listen == listenType && event.Script != nil {
			jsScript := strings.Join(event.Script.Exec, "\n")
			translatedHooks := script.TranslateJSToHook(jsScript, "postman")
			hooks = append(hooks, translatedHooks...)
		}
	}
	return hooks
}

func convertBody(body *Body) any {
	if body == nil {
		return nil
	}
	switch body.Mode {
	case "raw":
		return body.Raw
	case "formdata":
		data := make(map[string]string)
		for _, param := range body.Formdata {
			if enabled := param.Enabled; enabled == nil || *enabled {
				if param.Type == "text" {
					data[param.Key] = param.Value
				} else if param.Type == "file" {
					// TODO: handle file uploads
					data[param.Key] = fmt.Sprintf("file:%s", strings.Join(param.Src, ","))
				}
			}
		}
		return data
	case "urlencoded":
		data := make(map[string]string)
		for _, param := range body.Urlencoded {
			if enabled := param.Enabled; enabled == nil || *enabled {
				data[param.Key] = param.Value
			}
		}
		return data
	case "file":
		if body.File != nil && len(body.File.Src) > 0 {
			return fmt.Sprintf("file:%s", body.File.Src[0])
		}
	case "graphql":
		if body.Graphql != nil {
			return map[string]any{
				"query":     body.Graphql.Query,
				"variables": body.Graphql.Variables,
			}
		}
	}
	return nil
}
