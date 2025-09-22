package bruno

import (
	"encoding/json"
	"io"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Bruno export structure is varied; this minimal converter treats each request with method/url.
// This is a placeholder implementation to get started.
type brunoExport struct {
	Name     string     `json:"name"`
	Requests []brunoReq `json:"requests"`
}
type brunoReq struct {
	Name    string            `json:"name"`
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    any               `json:"body"`
}

func Convert(r io.Reader) (*models.Suite, error) {
	var ex brunoExport
	if err := json.NewDecoder(r).Decode(&ex); err != nil {
		return nil, err
	}
	s := &models.Suite{Name: ex.Name}
	for _, rq := range ex.Requests {
		s.Tests = append(s.Tests, models.TestCase{
			Name:    rq.Name,
			Request: models.Request{Method: rq.Method, URL: rq.URL, Headers: rq.Headers, Body: rq.Body},
			Assert:  models.Assertions{Status: 200},
		})
	}
	return s, nil
}
