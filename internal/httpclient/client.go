package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"time"
)

type Response struct {
	Status     int
	Headers    http.Header
	Body       []byte
	DurationMs int64
}

type Client struct {
	base *http.Client
}

func New(timeout time.Duration) *Client {
	return &Client{base: &http.Client{Timeout: timeout}}
}

func (c *Client) Do(ctx context.Context, method, urlStr string, headers map[string]string, query map[string]string, body any) (*Response, error) {
	u, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	for k, v := range query {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()

	var rdr io.Reader
	if body != nil {
		switch b := body.(type) {
		case string:
			rdr = bytes.NewBufferString(b)
		case []byte:
			rdr = bytes.NewBuffer(b)
		default:
			buf, err := json.Marshal(b)
			if err != nil {
				return nil, err
			}
			rdr = bytes.NewBuffer(buf)
			if headers == nil {
				headers = map[string]string{}
			}
			if _, ok := headers["Content-Type"]; !ok {
				headers["Content-Type"] = "application/json"
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, u.String(), rdr)
	if err != nil {
		return nil, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := c.base.Do(req)
	dur := time.Since(start)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return &Response{Status: resp.StatusCode, Headers: resp.Header, Body: b, DurationMs: dur.Milliseconds()}, nil
}
