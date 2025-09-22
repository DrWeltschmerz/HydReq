package har

import (
	"encoding/json"
	"io"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Minimal HAR structures
type harLog struct {
	Log struct {
		Creator struct {
			Name string `json:"name"`
		} `json:"creator"`
		Entries []harEntry `json:"entries"`
	} `json:"log"`
}
type harEntry struct {
	Request harRequest `json:"request"`
}
type harRequest struct {
	Method   string       `json:"method"`
	URL      string       `json:"url"`
	Headers  []harHeader  `json:"headers"`
	PostData *harPostData `json:"postData"`
}
type harHeader struct{ Name, Value string }
type harPostData struct {
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
}

func Convert(r io.Reader) (*models.Suite, error) {
	var h harLog
	if err := json.NewDecoder(r).Decode(&h); err != nil {
		return nil, err
	}
	s := &models.Suite{Name: h.Log.Creator.Name}
	for _, e := range h.Log.Entries {
		headers := map[string]string{}
		for _, hh := range e.Request.Headers {
			headers[hh.Name] = hh.Value
		}
		var body any
		if e.Request.PostData != nil && e.Request.PostData.Text != "" {
			body = e.Request.PostData.Text
		}
		s.Tests = append(s.Tests, models.TestCase{
			Name:    e.Request.Method + " " + e.Request.URL,
			Request: models.Request{Method: e.Request.Method, URL: e.Request.URL, Headers: headers, Body: body},
			Assert:  models.Assertions{Status: 200},
		})
	}
	return s, nil
}
