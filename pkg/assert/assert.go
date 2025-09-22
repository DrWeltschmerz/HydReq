package assert

import (
	"fmt"
)

type Result struct {
	Passed bool
	Msg    string
}

func ok(msg string) Result   { return Result{Passed: true, Msg: msg} }
func fail(msg string) Result { return Result{Passed: false, Msg: msg} }

func Equal[T comparable](got, want T, label string) Result {
	if got != want {
		return fail(fmt.Sprintf("%s: got %v, want %v", label, got, want))
	}
	return ok(fmt.Sprintf("%s: %v", label, want))
}

func Contains(haystack, needle, label string) Result {
	if needle == "" && haystack == "" {
		return ok(label + ": empty contains empty")
	}
	if len(needle) == 0 {
		return ok(label + ": trivially contains empty")
	}
	if !contains(haystack, needle) {
		return fail(fmt.Sprintf("%s: expected to contain %q", label, needle))
	}
	return ok(fmt.Sprintf("%s: contains %q", label, needle))
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (indexOf(s, sub) >= 0))
}

// naive index to avoid extra deps
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
