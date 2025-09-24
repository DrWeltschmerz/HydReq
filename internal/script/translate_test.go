package script

import (
	"strings"
	"testing"
)

func TestTranslateJSToHook_Postman(t *testing.T) {
	js := `pm.environment.set('token', 'abc123');
pm.globals.set('userId', '456');`

	hooks := TranslateJSToHook(js, "postman")

	if len(hooks) != 2 {
		t.Fatalf("expected 2 hooks, got %d", len(hooks))
	}

	// First hook should be vars
	if hooks[0].Vars["token"] != "abc123" {
		t.Errorf("expected token=abc123, got %v", hooks[0].Vars)
	}

	if hooks[1].Vars["userId"] != "456" {
		t.Errorf("expected userId=456, got %v", hooks[1].Vars)
	}
}

func TestTranslateJSToHook_Insomnia(t *testing.T) {
	js := `insomnia.globals.set('apiKey', 'secret');`

	hooks := TranslateJSToHook(js, "insomnia")

	if len(hooks) != 1 {
		t.Fatalf("expected 1 hook, got %d", len(hooks))
	}

	if hooks[0].Vars["apiKey"] != "secret" {
		t.Errorf("expected apiKey=secret, got %v", hooks[0].Vars)
	}
}

func TestTranslateJSToHook_Bruno(t *testing.T) {
	js := `bru.setVar('endpoint', '/api/v1');`

	hooks := TranslateJSToHook(js, "bruno")

	if len(hooks) != 1 {
		t.Fatalf("expected 1 hook, got %d", len(hooks))
	}

	if hooks[0].Vars["endpoint"] != "/api/v1" {
		t.Errorf("expected endpoint=/api/v1, got %v", hooks[0].Vars)
	}
}

func TestTranslateJSToHook_ComplexJS(t *testing.T) {
	js := `console.log('Complex logic');
setVar('computed', 'value');`

	hooks := TranslateJSToHook(js, "postman")

	if len(hooks) != 2 {
		t.Fatalf("expected 2 hooks, got %d", len(hooks))
	}

	// First hook should be JS
	if hooks[0].JS == nil {
		t.Fatal("expected first hook to be JS")
	}

	if !strings.Contains(hooks[0].JS.Code, "console.log") {
		t.Errorf("expected console.log in first hook, got %q", hooks[0].JS.Code)
	}

	// Second hook should be JS
	if hooks[1].JS == nil {
		t.Fatal("expected second hook to be JS")
	}

	if !strings.Contains(hooks[1].JS.Code, "setVar") {
		t.Errorf("expected setVar in second hook, got %q", hooks[1].JS.Code)
	}
}

func TestSplitJSStatements(t *testing.T) {
	js := `stmt1; stmt2; stmt3;`

	stmts := splitJSStatements(js)

	expected := []string{"stmt1;", "stmt2;", "stmt3;"}
	if len(stmts) != len(expected) {
		t.Fatalf("expected %d statements, got %d", len(expected), len(stmts))
	}

	for i, stmt := range stmts {
		if stmt != expected[i] {
			t.Errorf("statement %d: expected %q, got %q", i, expected[i], stmt)
		}
	}
}

func TestSplitJSStatements_WithStrings(t *testing.T) {
	js := `setVar('key', 'value;with;semicolons'); otherStmt;`

	stmts := splitJSStatements(js)

	if len(stmts) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(stmts))
	}

	if stmts[0] != `setVar('key', 'value;with;semicolons');` {
		t.Errorf("first statement: %q", stmts[0])
	}

	if stmts[1] != "otherStmt;" {
		t.Errorf("second statement: %q", stmts[1])
	}
}
