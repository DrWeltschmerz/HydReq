package postman

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Minimal Postman v2.1 structures (subset)
type Collection struct {
	Info struct {
		Name string `json:"name"`
	} `json:"info"`
	Item []Item `json:"item"`
}

type Item struct {
	Name    string   `json:"name"`
	Request *Request `json:"request"`
	Item    []Item   `json:"item"` // folders
}

type Request struct {
	Method string      `json:"method"`
	URL    interface{} `json:"url"` // can be string or object
	Header []KV        `json:"header"`
	Body   *Body       `json:"body"`
}

type KV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}
type Body struct {
	Mode string `json:"mode"`
	Raw  string `json:"raw"`
}

func Convert(r io.Reader) (*models.Suite, error) {
	var c Collection
	if err := json.NewDecoder(r).Decode(&c); err != nil {
		return nil, err
	}
	suite := &models.Suite{Name: c.Info.Name}
	// flatten items
	var walk func(items []Item)
	walk = func(items []Item) {
		for _, it := range items {
			if it.Request == nil && len(it.Item) > 0 {
				walk(it.Item)
				continue
			}
			if it.Request == nil {
				continue
			}
			req := it.Request
			url := resolveURLFromPostman(req.URL)
			headers := map[string]string{}
			for _, h := range req.Header {
				headers[h.Key] = h.Value
			}
			var body any
			if req.Body != nil && req.Body.Mode == "raw" && strings.TrimSpace(req.Body.Raw) != "" {
				body = req.Body.Raw
				if _, ok := headers["Content-Type"]; !ok {
					headers["Content-Type"] = "application/json"
				}
			}
			tc := models.TestCase{
				Name:    it.Name,
				Request: models.Request{Method: req.Method, URL: url, Headers: headers, Body: body},
				Assert:  models.Assertions{Status: 200},
			}
			suite.Tests = append(suite.Tests, tc)
		}
	}
	walk(c.Item)
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
		if p, ok := t["path"].([]interface{}); ok {
			parts := make([]string, 0, len(p))
			for _, v := range p {
				parts = append(parts, fmt.Sprintf("%v", v))
			}
			return "/" + strings.Join(parts, "/")
		}
		return ""
	default:
		return ""
	}
}
