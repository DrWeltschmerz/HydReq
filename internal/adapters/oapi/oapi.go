package oapi

import (
	"io"
	"strconv"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
	"gopkg.in/yaml.v3"
)

type spec struct {
	Info struct {
		Title string `yaml:"title"`
	} `yaml:"info"`
	Servers []struct {
		URL string `yaml:"url"`
	} `yaml:"servers"`
	Paths map[string]pathItem `yaml:"paths"`
}

type pathItem struct {
	Get     *operation `yaml:"get"`
	Put     *operation `yaml:"put"`
	Post    *operation `yaml:"post"`
	Delete  *operation `yaml:"delete"`
	Options *operation `yaml:"options"`
	Head    *operation `yaml:"head"`
	Patch   *operation `yaml:"patch"`
	Trace   *operation `yaml:"trace"`
}

type operation struct {
	Tags      []string               `yaml:"tags"`
	Responses map[string]interface{} `yaml:"responses"`
}

// Convert reads an OpenAPI (3.x) YAML/JSON spec and produces a basic Suite with one test per operation.
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
	if len(sp.Servers) > 0 {
		s.BaseURL = sp.Servers[0].URL
	}

	add := func(method, path string, op *operation) {
		if op == nil {
			return
		}
		status := pickStatus(op)
		s.Tests = append(s.Tests, models.TestCase{
			Name:    method + " " + path,
			Request: models.Request{Method: method, URL: path},
			Assert:  models.Assertions{Status: status},
			Tags:    op.Tags,
		})
	}

	for p, item := range sp.Paths {
		add("GET", p, item.Get)
		add("PUT", p, item.Put)
		add("POST", p, item.Post)
		add("DELETE", p, item.Delete)
		add("OPTIONS", p, item.Options)
		add("HEAD", p, item.Head)
		add("PATCH", p, item.Patch)
		add("TRACE", p, item.Trace)
	}
	return s, nil
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
