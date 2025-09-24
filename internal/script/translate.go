package script

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

// TranslateJSToHook converts JavaScript code from external tools to HydReq hooks
func TranslateJSToHook(jsCode, source string) []models.Hook {
	var hooks []models.Hook

	// Split multi-line JS into statements
	statements := splitJSStatements(jsCode)

	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		// Try pattern-based translation first
		if hook := translatePatternToHook(stmt, source); hook != nil {
			hooks = append(hooks, *hook)
			continue
		}

		// Fall back to JS hook for complex logic
		hook := models.Hook{
			Name: fmt.Sprintf("%s script", source),
			JS: &models.JSHook{
				Code: translateJSApi(stmt, source),
			},
		}
		hooks = append(hooks, hook)
	}

	return hooks
}

// splitJSStatements splits JavaScript code into individual statements
func splitJSStatements(jsCode string) []string {
	// Simple splitting on semicolons, ignoring those in strings
	var statements []string
	var current strings.Builder
	inString := false
	stringChar := byte(0)

	for i := 0; i < len(jsCode); i++ {
		char := jsCode[i]

		if !inString && (char == '"' || char == '\'') {
			inString = true
			stringChar = char
		} else if inString && char == stringChar && jsCode[i-1] != '\\' {
			inString = false
			stringChar = 0
		} else if !inString && char == ';' {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt+";")
			}
			current.Reset()
			continue
		}

		current.WriteByte(char)
	}

	// Add remaining statement
	if remaining := strings.TrimSpace(current.String()); remaining != "" {
		statements = append(statements, remaining)
	}

	return statements
}

// translatePatternToHook converts common patterns to native HydReq features
func translatePatternToHook(stmt, source string) *models.Hook {
	switch source {
	case "postman":
		return translatePostmanPattern(stmt)
	case "insomnia":
		return translateInsomniaPattern(stmt)
	case "bruno":
		return translateBrunoPattern(stmt)
	}
	return nil
}

// translatePostmanPattern handles Postman-specific patterns
func translatePostmanPattern(stmt string) *models.Hook {
	// pm.environment.set('key', 'value')
	if matched, _ := regexp.MatchString(`pm\.environment\.set\(`, stmt); matched {
		return translatePostmanEnvSet(stmt)
	}

	// pm.globals.set('key', 'value')
	if matched, _ := regexp.MatchString(`pm\.globals\.set\(`, stmt); matched {
		return translatePostmanGlobalSet(stmt)
	}

	// pm.test('name', function() { ... })
	if matched, _ := regexp.MatchString(`pm\.test\(`, stmt); matched {
		return translatePostmanTest(stmt)
	}

	return nil
}

// translatePostmanEnvSet converts pm.environment.set to HydReq vars
func translatePostmanEnvSet(stmt string) *models.Hook {
	re := regexp.MustCompile(`pm\.environment\.set\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)`)
	matches := re.FindStringSubmatch(stmt)
	if len(matches) == 3 {
		return &models.Hook{
			Name: "Postman environment variable",
			Vars: map[string]string{
				matches[1]: matches[2],
			},
		}
	}
	return nil
}

// translatePostmanGlobalSet converts pm.globals.set to HydReq vars
func translatePostmanGlobalSet(stmt string) *models.Hook {
	re := regexp.MustCompile(`pm\.globals\.set\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)`)
	matches := re.FindStringSubmatch(stmt)
	if len(matches) == 3 {
		return &models.Hook{
			Name: "Postman global variable",
			Vars: map[string]string{
				matches[1]: matches[2],
			},
		}
	}
	return nil
}

// translatePostmanTest converts pm.test to HydReq assertions
func translatePostmanTest(stmt string) *models.Hook {
	// This is complex - for now, just wrap in JS
	return nil
}

// translateInsomniaPattern handles Insomnia-specific patterns
func translateInsomniaPattern(stmt string) *models.Hook {
	// insomnia.globals.set('key', 'value')
	if matched, _ := regexp.MatchString(`insomnia\.globals\.set\(`, stmt); matched {
		re := regexp.MustCompile(`insomnia\.globals\.set\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\)`)
		matches := re.FindStringSubmatch(stmt)
		if len(matches) == 3 {
			return &models.Hook{
				Name: "Insomnia global variable",
				Vars: map[string]string{
					matches[1]: strings.Trim(matches[2], "'\""),
				},
			}
		}
	}
	return nil
}

// translateBrunoPattern handles Bruno-specific patterns
func translateBrunoPattern(stmt string) *models.Hook {
	// bru.setVar('key', 'value')
	if matched, _ := regexp.MatchString(`bru\.setVar\(`, stmt); matched {
		re := regexp.MustCompile(`bru\.setVar\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)`)
		matches := re.FindStringSubmatch(stmt)
		if len(matches) == 3 {
			return &models.Hook{
				Name: "Bruno variable",
				Vars: map[string]string{
					matches[1]: matches[2],
				},
			}
		}
	}
	return nil
}

// translateJSApi converts external JS APIs to HydReq equivalents
func translateJSApi(stmt, source string) string {
	switch source {
	case "postman":
		return translatePostmanAPI(stmt)
	case "insomnia":
		return translateInsomniaAPI(stmt)
	case "bruno":
		return translateBrunoAPI(stmt)
	}
	return stmt
}

// translatePostmanAPI converts Postman APIs to HydReq equivalents
func translatePostmanAPI(stmt string) string {
	// pm.environment.set('key', 'value') -> setVar('key', 'value')
	stmt = regexp.MustCompile(`pm\.environment\.set\(`).ReplaceAllString(stmt, `setVar(`)
	stmt = regexp.MustCompile(`pm\.globals\.set\(`).ReplaceAllString(stmt, `setVar(`)

	// pm.environment.get('key') -> getVar('key')
	stmt = regexp.MustCompile(`pm\.environment\.get\(`).ReplaceAllString(stmt, `getVar(`)
	stmt = regexp.MustCompile(`pm\.globals\.get\(`).ReplaceAllString(stmt, `getVar(`)

	return stmt
}

// translateInsomniaAPI converts Insomnia APIs to HydReq equivalents
func translateInsomniaAPI(stmt string) string {
	// insomnia.globals.set('key', 'value') -> setVar('key', 'value')
	stmt = regexp.MustCompile(`insomnia\.globals\.set\(`).ReplaceAllString(stmt, `setVar(`)
	stmt = regexp.MustCompile(`insomnia\.globals\.get\(`).ReplaceAllString(stmt, `getVar(`)

	return stmt
}

// translateBrunoAPI converts Bruno APIs to HydReq equivalents
func translateBrunoAPI(stmt string) string {
	// bru.setVar('key', 'value') -> setVar('key', 'value')
	stmt = regexp.MustCompile(`bru\.setVar\(`).ReplaceAllString(stmt, `setVar(`)
	stmt = regexp.MustCompile(`bru\.getVar\(`).ReplaceAllString(stmt, `getVar(`)

	return stmt
}
