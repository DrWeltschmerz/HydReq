package oapi

import (
	"io"
	"strconv"
	"strings"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
	"gopkg.in/yaml.v3"
)

type spec struct {
	// OpenAPI 3.0+ fields
	OpenAPI string `yaml:"openapi,omitempty"`
	Info    struct {
		Title string `yaml:"title"`
	} `yaml:"info"`
	Servers []struct {
		URL string `yaml:"url"`
	} `yaml:"servers,omitempty"`

	// Swagger 2.0 fields
	Swagger  string   `yaml:"swagger,omitempty"`
	Host     string   `yaml:"host,omitempty"`
	BasePath string   `yaml:"basePath,omitempty"`
	Schemes  []string `yaml:"schemes,omitempty"`

	Paths      map[string]pathItem   `yaml:"paths"`
	Components *components           `yaml:"components,omitempty"`
	Security   []map[string][]string `yaml:"security,omitempty"`

	// Swagger 2.0 security definitions
	SecurityDefinitions map[string]securityScheme `yaml:"securityDefinitions,omitempty"`
}

type components struct {
	SecuritySchemes map[string]securityScheme `yaml:"securitySchemes,omitempty"`
}

type securityScheme struct {
	Type   string `yaml:"type"`
	Scheme string `yaml:"scheme,omitempty"`
	In     string `yaml:"in,omitempty"`
	Name   string `yaml:"name,omitempty"`
}

type pathItem struct {
	Parameters []parameter `yaml:"parameters,omitempty"`
	Get        *operation  `yaml:"get,omitempty"`
	Put        *operation  `yaml:"put,omitempty"`
	Post       *operation  `yaml:"post,omitempty"`
	Delete     *operation  `yaml:"delete,omitempty"`
	Options    *operation  `yaml:"options,omitempty"`
	Head       *operation  `yaml:"head,omitempty"`
	Patch      *operation  `yaml:"patch,omitempty"`
	Trace      *operation  `yaml:"trace,omitempty"`
}

type operation struct {
	Tags        []string               `yaml:"tags,omitempty"`
	Parameters  []parameter            `yaml:"parameters,omitempty"`
	RequestBody *requestBody           `yaml:"requestBody,omitempty"`
	Responses   map[string]interface{} `yaml:"responses,omitempty"`
	Security    []map[string][]string  `yaml:"security,omitempty"`
}

type parameter struct {
	Name     string  `yaml:"name"`
	In       string  `yaml:"in"`
	Required bool    `yaml:"required,omitempty"`
	Schema   *schema `yaml:"schema,omitempty"`
}

type requestBody struct {
	Required bool                 `yaml:"required,omitempty"`
	Content  map[string]mediaType `yaml:"content,omitempty"`
}

type mediaType struct {
	Schema *schema `yaml:"schema,omitempty"`
}

type schema struct {
	Type string `yaml:"type,omitempty"`
}

// Convert reads an OpenAPI (3.x) or Swagger (2.0) YAML/JSON spec and produces a basic Suite with one test per operation.
func Convert(r io.Reader) (*models.Suite, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	var sp spec
	if err := yaml.Unmarshal(data, &sp); err != nil {
		return nil, err
	}

	s := &models.Suite{Name: sp.Info.Title}

	// Handle base URL for both OpenAPI 3.0+ and Swagger 2.0
	if sp.OpenAPI != "" {
		// OpenAPI 3.0+ format
		if len(sp.Servers) > 0 {
			s.BaseURL = sp.Servers[0].URL
		}
	} else if sp.Swagger == "2.0" {
		// Swagger 2.0 format
		if sp.Host != "" {
			scheme := "https" // default
			if len(sp.Schemes) > 0 {
				scheme = sp.Schemes[0] // prefer first scheme
			}
			s.BaseURL = scheme + "://" + sp.Host
			if sp.BasePath != "" {
				s.BaseURL += sp.BasePath
			}
		}
	}

	// Handle global security
	if sp.OpenAPI != "" && len(sp.Security) > 0 && sp.Components != nil {
		// OpenAPI 3.0+ security
		s.Auth = convertSecurity(sp.Security[0], sp.Components.SecuritySchemes)
	} else if sp.Swagger == "2.0" && len(sp.Security) > 0 && sp.SecurityDefinitions != nil {
		// Swagger 2.0 security
		s.Auth = convertSecurity(sp.Security[0], sp.SecurityDefinitions)
	}

	add := func(method, path string, op *operation, pathParams []parameter) {
		if op == nil {
			return
		}
		status := pickStatus(op)
		req := models.Request{Method: method, URL: path}

		// Combine path and operation parameters
		allParams := append(pathParams, op.Parameters...)

		// Handle parameters
		headers := make(map[string]string)
		query := make(map[string]string)
		for _, p := range allParams {
			if p.In == "header" {
				headers[p.Name] = "example" // TODO: generate from schema
			} else if p.In == "query" {
				query[p.Name] = "example"
			} else if p.In == "path" {
				// Replace in URL
				req.URL = strings.Replace(req.URL, "{"+p.Name+"}", "example", -1)
			}
		}
		req.Headers = headers
		req.Query = query

		// Handle request body
		if op.RequestBody != nil && len(op.RequestBody.Content) > 0 {
			for contentType, mt := range op.RequestBody.Content {
				headers["Content-Type"] = contentType
				if mt.Schema != nil && mt.Schema.Type == "object" {
					req.Body = map[string]interface{}{"example": "data"} // TODO: generate from schema
				}
				break // Use first content type
			}
		}

		tc := models.TestCase{
			Name:    method + " " + path,
			Request: req,
			Assert:  models.Assertions{Status: status},
			Tags:    op.Tags,
		}

		// Handle operation security
		if len(op.Security) > 0 && sp.Components != nil {
			// TODO: per-test auth
		}

		s.Tests = append(s.Tests, tc)
	}

	for p, item := range sp.Paths {
		add("GET", p, item.Get, item.Parameters)
		add("PUT", p, item.Put, item.Parameters)
		add("POST", p, item.Post, item.Parameters)
		add("DELETE", p, item.Delete, item.Parameters)
		add("OPTIONS", p, item.Options, item.Parameters)
		add("HEAD", p, item.Head, item.Parameters)
		add("PATCH", p, item.Patch, item.Parameters)
		add("TRACE", p, item.Trace, item.Parameters)
	}
	return s, nil
}

func convertSecurity(sec map[string][]string, schemes map[string]securityScheme) *models.Auth {
	for schemeName := range sec {
		if scheme, ok := schemes[schemeName]; ok {
			switch scheme.Type {
			case "http":
				if scheme.Scheme == "basic" {
					return &models.Auth{BasicEnv: "username:password"}
				} else if scheme.Scheme == "bearer" {
					return &models.Auth{BearerEnv: "token"}
				}
			case "apiKey":
				if scheme.In == "header" {
					// TODO: handle api key
				}
			}
		}
	}
	return nil
}

func pickStatus(op *operation) int {
	if op == nil || len(op.Responses) == 0 {
		return 200
	}
	if _, ok := op.Responses["200"]; ok {
		return 200
	}
	for code := range op.Responses {
		if code == "default" {
			continue
		}
		if n, err := strconv.Atoi(code); err == nil {
			return n
		}
	}
	return 200
}
