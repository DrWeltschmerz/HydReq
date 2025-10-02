package validate

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	jsonschema "github.com/santhosh-tekuri/jsonschema/v5"
	"gopkg.in/yaml.v3"
)

// FormatValidationError tries to turn a jsonschema error into a friendly message that
// includes a readable path and YAML line/column if possible, along with a hint.
func FormatValidationError(yamlBytes []byte, err error) string {
	ve, ok := err.(*jsonschema.ValidationError)
	if !ok {
		return err.Error()
	}
	// Parse YAML to build an AST and map JSON Pointer to node
	var root yaml.Node
	if yamlErr := yaml.Unmarshal(yamlBytes, &root); yamlErr != nil {
		return ve.Error()
	}

	var b strings.Builder
	// Flatten top-level error and a few causes
	writeOne := func(e *jsonschema.ValidationError) {
		path := pointerToDot(e.InstanceLocation)
		n := findNodeByPointer(&root, e.InstanceLocation)
		loc := ""
		if n != nil {
			loc = fmt.Sprintf(" (line %d, col %d)", n.Line, n.Column)
		}
		msg := e.Error()
		// Try to compact the message by removing long schema URLs
		if idx := strings.Index(msg, " does not validate with "); idx >= 0 {
			// message after colon typically contains useful part
			if j := strings.LastIndex(msg, ": "); j > idx {
				msg = msg[j+2:]
			}
		}
		fmt.Fprintf(&b, "at %s%s: %s", path, loc, msg)
		if hint := hintForPathAndMessage(path, msg); hint != "" {
			fmt.Fprintf(&b, "\n  hint: %s", hint)
		}
	}

	writeOne(ve)
	// Also include up to first 3 causes if present
	if len(ve.Causes) > 0 {
		max := len(ve.Causes)
		if max > 3 {
			max = 3
		}
		for i := 0; i < max; i++ {
			b.WriteString("\n  → ")
			writeOne(ve.Causes[i])
		}
	}
	return b.String()
}

// pointerToDot converts a JSON pointer like "/tests/0/assert/jsonEquals" to
// a readable path like "tests[0].assert.jsonEquals".
func pointerToDot(ptr string) string {
	if ptr == "" || ptr == "/" {
		return "<root>"
	}
	segs := strings.Split(ptr, "/")
	out := make([]string, 0, len(segs))
	for _, s := range segs {
		if s == "" {
			continue
		}
		s = strings.ReplaceAll(strings.ReplaceAll(s, "~1", "/"), "~0", "~")
		if _, err := strconv.Atoi(s); err == nil {
			// index
			if len(out) == 0 {
				out = append(out, fmt.Sprintf("[%s]", s))
			} else {
				out[len(out)-1] = out[len(out)-1] + fmt.Sprintf("[%s]", s)
			}
		} else {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return "<root>"
	}
	return strings.Join(out, ".")
}

// findNodeByPointer walks the YAML AST to the node matching the JSON Pointer.
func findNodeByPointer(root *yaml.Node, ptr string) *yaml.Node {
	// The first content element under Document is the mapping/seq root
	if root.Kind == yaml.DocumentNode && len(root.Content) > 0 {
		root = root.Content[0]
	}
	if ptr == "" || ptr == "/" {
		return root
	}
	segs := strings.Split(ptr, "/")
	cur := root
	for _, raw := range segs {
		if raw == "" {
			continue
		}
		s := strings.ReplaceAll(strings.ReplaceAll(raw, "~1", "/"), "~0", "~")
		switch cur.Kind {
		case yaml.MappingNode:
			// content in pairs key,value
			found := false
			for i := 0; i+1 < len(cur.Content); i += 2 {
				k := cur.Content[i]
				v := cur.Content[i+1]
				if k.Value == s {
					cur = v
					found = true
					break
				}
			}
			if !found {
				return cur
			}
		case yaml.SequenceNode:
			idx, err := strconv.Atoi(s)
			if err != nil || idx < 0 || idx >= len(cur.Content) {
				return cur
			}
			cur = cur.Content[idx]
		default:
			return cur
		}
	}
	return cur
}

var expGotRe = regexp.MustCompile(`expected ([^,]+), but got ([^\s]+)`) // best-effort

func hintForPathAndMessage(path, msg string) string {
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".jsonequals") {
		if m := expGotRe.FindStringSubmatch(msg); len(m) == 3 && strings.Contains(m[1], "object") {
			return "jsonEquals must be a mapping of jsonPath -> expected value, e.g. jsonEquals: { json.id: \"123\" }"
		}
		return "jsonEquals must be a mapping of jsonPath -> expected value"
	}
	if strings.HasSuffix(lower, ".extract") {
		return "extract must be a mapping of varName -> { jsonPath: <path> } (or header/body extraction)"
	}
	if strings.HasSuffix(lower, ".request.body") {
		return "body should match the schema (object/array/scalar as expected); check indentation and types"
	}
	return ""
}

// optional: in case callers have JSON bytes and need a pointer locator later
func _unusedEnsureJSON(b []byte) any {
	var v any
	_ = json.Unmarshal(b, &v)
	return v
}

// PathToFileURL converts an absolute file path to a proper RFC 8089 file:// URL
// that works consistently across Windows and Unix platforms.
//
// On Windows, converts C:\path\to\file to file:///C:/path/to/file
// On Unix, converts /path/to/file to file:///path/to/file
func PathToFileURL(absPath string) string {
	// Convert backslashes to forward slashes for Windows paths
	// We use strings.ReplaceAll instead of filepath.ToSlash because
	// filepath.ToSlash only converts the OS-native separator
	absPath = strings.ReplaceAll(absPath, "\\", "/")

	// Ensure the path starts with / for proper file URL formatting
	// Windows paths like C:/... become /C:/... then file:///C:/...
	// Unix paths like /home/... stay as /home/... then file:///home/...
	if !strings.HasPrefix(absPath, "/") {
		absPath = "/" + absPath
	}

	return "file://" + absPath
}
