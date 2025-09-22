package insomnia

import (
	"encoding/json"
	"io"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Minimal Insomnia export structures (subset)
type Export struct {
	Resources []Resource `json:"resources"`
}

type Resource struct {
	Type    string   `json:"_type"`
	Name    string   `json:"name"`
	Method  string   `json:"method"`
	URL     string   `json:"url"`
	Headers []Header `json:"headers"`
	Body    *Body    `json:"body"`
}

type Header struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}
type Body struct {
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
}

func Convert(r io.Reader) (*models.Suite, error) {
	var exp Export
	if err := json.NewDecoder(r).Decode(&exp); err != nil {
		return nil, err
	}
	suite := &models.Suite{Name: "insomnia import"}
	for _, res := range exp.Resources {
		// Requests are resources with _type == "request"
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
	return suite, nil
}
