package bruno

import (
	"encoding/json"
	"io"

	"github.com/DrWeltschmerz/HydReq/internal/script"
	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// Bruno JSON export structure
type brunoExport struct {
	Name         string      `json:"name"`
	Items        []brunoItem `json:"items,omitempty"`
	Environments []brunoEnv  `json:"environments,omitempty"`
	Requests     []brunoReq  `json:"requests,omitempty"` // legacy
}

type brunoItem struct {
	Uid     string      `json:"uid"`
	Name    string      `json:"name"`
	Type    string      `json:"type"` // http-request, folder
	Seq     int         `json:"seq,omitempty"`
	Request *brunoReq   `json:"request,omitempty"`
	Items   []brunoItem `json:"items,omitempty"`
}

type brunoReq struct {
	Method     string           `json:"method"`
	Url        string           `json:"url"`
	Headers    []brunoKV        `json:"headers,omitempty"`
	Params     []brunoKV        `json:"params,omitempty"`
	Auth       *brunoAuth       `json:"auth,omitempty"`
	Body       *brunoBody       `json:"body,omitempty"`
	Script     *brunoScript     `json:"script,omitempty"`
	Vars       *brunoVars       `json:"vars,omitempty"`
	Assertions []brunoAssertion `json:"assertions,omitempty"`
}

type brunoKV struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type,omitempty"`
}

type brunoAuth struct {
	Mode   string       `json:"mode"`
	Basic  *brunoBasic  `json:"basic,omitempty"`
	Bearer *brunoBearer `json:"bearer,omitempty"`
	// Add other modes
}

type brunoBasic struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type brunoBearer struct {
	Token string `json:"token"`
}

type brunoBody struct {
	Mode           string    `json:"mode"`
	Json           string    `json:"json,omitempty"`
	Text           string    `json:"text,omitempty"`
	Xml            string    `json:"xml,omitempty"`
	FormUrlEncoded []brunoKV `json:"formUrlEncoded,omitempty"`
	MultipartForm  []brunoKV `json:"multipartForm,omitempty"`
}

type brunoScript struct {
	Req string `json:"req,omitempty"`
	Res string `json:"res,omitempty"`
}

type brunoVars struct {
	Req []brunoKV `json:"req,omitempty"`
	Res []brunoKV `json:"res,omitempty"`
}

type brunoAssertion struct {
	Uid     string `json:"uid"`
	Name    string `json:"name"`
	Type    string `json:"type"`
	Enabled bool   `json:"enabled"`
}

type brunoEnv struct {
	Uid       string        `json:"uid"`
	Name      string        `json:"name"`
	Variables []brunoEnvVar `json:"variables"`
}

type brunoEnvVar struct {
	Uid     string `json:"uid"`
	Name    string `json:"name"`
	Value   string `json:"value"`
	Type    string `json:"type"`
	Enabled bool   `json:"enabled"`
	Secret  bool   `json:"secret"`
}

// Convert converts Bruno JSON export to HydReq Suite
func Convert(r io.Reader) (*models.Suite, error) {
	var export brunoExport
	if err := json.NewDecoder(r).Decode(&export); err != nil {
		return nil, err
	}

	suite := &models.Suite{
		Name: export.Name,
	}

	// Handle environments
	if len(export.Environments) > 0 {
		suite.Variables = make(map[string]string)
		for _, env := range export.Environments {
			for _, v := range env.Variables {
				if v.Enabled {
					suite.Variables[v.Name] = v.Value
				}
			}
		}
	}

	// Handle legacy requests array or new items
	if len(export.Requests) > 0 {
		for _, req := range export.Requests {
			tc := convertRequest(req)
			suite.Tests = append(suite.Tests, tc)
		}
	} else {
		// Process items recursively
		for _, item := range export.Items {
			processItem(&item, suite, "")
		}
	}

	return suite, nil
}

func processItem(item *brunoItem, suite *models.Suite, prefix string) {
	fullName := item.Name
	if prefix != "" {
		fullName = prefix + "/" + item.Name
	}

	if item.Type == "http-request" && item.Request != nil {
		tc := convertRequest(*item.Request)
		tc.Name = fullName
		suite.Tests = append(suite.Tests, tc)
	} else if item.Type == "folder" {
		for _, subItem := range item.Items {
			processItem(&subItem, suite, fullName)
		}
	}
}

func convertRequest(req brunoReq) models.TestCase {
	tc := models.TestCase{
		Request: models.Request{
			Method: req.Method,
			URL:    req.Url,
		},
	}

	// Convert headers
	if req.Headers != nil {
		tc.Request.Headers = make(map[string]string)
		for _, h := range req.Headers {
			if h.Enabled {
				tc.Request.Headers[h.Name] = h.Value
			}
		}
	}

	// Convert query params
	if req.Params != nil {
		tc.Request.Query = make(map[string]string)
		for _, p := range req.Params {
			if p.Enabled {
				tc.Request.Query[p.Name] = p.Value
			}
		}
	}

	// Convert auth
	if req.Auth != nil {
		authHeaders := convertBrunoAuthToHeaders(req.Auth)
		if tc.Request.Headers == nil {
			tc.Request.Headers = make(map[string]string)
		}
		for k, v := range authHeaders {
			tc.Request.Headers[k] = v
		}
	}

	// Convert body
	if req.Body != nil {
		tc.Request.Body = convertBody(req.Body)
	}

	// Convert scripts to hooks
	if req.Script != nil {
		tc.Pre = convertScriptToHooks(req.Script.Req, "pre-request")
		tc.Post = convertScriptToHooks(req.Script.Res, "post-response")
	}

	// Convert vars
	if req.Vars != nil {
		tc.Vars = convertVars(req.Vars)
	}

	// Convert assertions
	if req.Assertions != nil {
		tc.Assert = convertAssertions(req.Assertions)
	}

	return tc
}

func convertBody(body *brunoBody) any {
	if body == nil {
		return nil
	}

	switch body.Mode {
	case "json":
		return body.Json
	case "text":
		return body.Text
	case "xml":
		return body.Xml
	case "formUrlEncoded":
		// Convert to map
		result := make(map[string]string)
		for _, kv := range body.FormUrlEncoded {
			if kv.Enabled {
				result[kv.Name] = kv.Value
			}
		}
		return result
	case "multipartForm":
		// Placeholder - multipart is complex
		return "multipart form data (not yet supported)"
	}
	return nil
}

func convertScriptToHooks(jsScript, name string) []models.Hook {
	if jsScript == "" {
		return nil
	}
	return script.TranslateJSToHook(jsScript, "bruno")
}

func convertVars(vars *brunoVars) map[string]string {
	if vars == nil {
		return nil
	}
	result := make(map[string]string)
	for _, v := range vars.Req {
		if v.Enabled {
			result[v.Name] = v.Value
		}
	}
	for _, v := range vars.Res {
		if v.Enabled {
			result[v.Name] = v.Value
		}
	}
	return result
}

func convertAssertions(assertions []brunoAssertion) models.Assertions {
	result := models.Assertions{}
	for _, a := range assertions {
		if a.Enabled {
			// Placeholder mapping - Bruno assertions to HydReq assertions
			// This would need more sophisticated mapping
			switch a.Type {
			case "status":
				// Assume value is int
				// result.Status = parseInt(a.Value)
			case "header":
				if result.HeaderEquals == nil {
					result.HeaderEquals = make(map[string]string)
				}
				// result.HeaderEquals[a.Name] = a.Value
			}
		}
	}
	return result
}

func convertBrunoAuthToHeaders(auth *brunoAuth) map[string]string {
	headers := make(map[string]string)
	if auth == nil {
		return headers
	}

	switch auth.Mode {
	case "basic":
		if auth.Basic != nil && auth.Basic.Username != "" {
			headers["Authorization"] = "Basic " + auth.Basic.Username + ":" + auth.Basic.Password
		}
	case "bearer":
		if auth.Bearer != nil && auth.Bearer.Token != "" {
			headers["Authorization"] = "Bearer " + auth.Bearer.Token
		}
	}
	return headers
}

func basicAuthEncode(username, password string) string {
	// Placeholder for basic auth encoding
	// This should return the base64 encoded string of "username:password"
	return username + ":" + password // TODO: replace with base64 encoding
}
