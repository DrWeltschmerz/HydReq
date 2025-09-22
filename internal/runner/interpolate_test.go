package runner

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/DrWeltschmerz/HydReq/pkg/models"
)

func TestInterpolate(t *testing.T) {
	vars := map[string]string{"a": "1", "b": "two"}
	got := interpolate("x-${a}-${b}", vars)
	if got != "x-1-two" {
		t.Fatalf("got %q", got)
	}
}

func TestInterpolateAny(t *testing.T) {
	vars := map[string]string{"x": "A"}
	in := map[string]any{
		"s":   "${x}",
		"arr": []any{"${x}", 2},
	}
	out := interpolateAny(in, vars).(map[string]any)
	if out["s"].(string) != "A" {
		t.Fatalf("string not interpolated: %+v", out)
	}
	arr := out["arr"].([]any)
	if arr[0].(string) != "A" {
		t.Fatalf("array[0] not interpolated: %+v", out)
	}
}

func TestInterpolateEnv(t *testing.T) {
	t.Setenv("FOO", "bar")
	got := interpolate("hello ${ENV:FOO}", map[string]string{})
	if got != "hello bar" {
		t.Fatalf("env expansion failed: %q", got)
	}
}

func TestAnyTagMatch(t *testing.T) {
	if !anyTagMatch([]string{"smoke", "api"}, []string{"smoke"}) {
		t.Fatal("expected match")
	}
	if anyTagMatch([]string{"db"}, []string{"smoke", "api"}) {
		t.Fatal("unexpected match")
	}
	if !anyTagMatch([]string{"SMOKE"}, []string{"smoke"}) {
		t.Fatal("case-insensitive match expected")
	}
}

func TestExpandTestCases(t *testing.T) {
	t1 := []models.TestCase{{
		Name: "matrix demo",
		Matrix: map[string][]string{
			"color": {"red", "blue"},
			"size":  {"S", "M"},
		},
	}}
	got := expandTestCases(t1)
	if len(got) != 4 {
		t.Fatalf("expected 4 cases, got %d", len(got))
	}
	names := map[string]bool{}
	for _, c := range got {
		names[c.Name] = true
	}
	if !names["matrix demo [color=blue,size=M]"] {
		t.Fatalf("missing expanded name: %+v", names)
	}
}

func TestWithJitterBounds(t *testing.T) {
	d := time.Second
	for i := 0; i < 10; i++ {
		x := withJitter(d, 10)
		// should be within +/-10%
		if x < d-d/10 || x > d+d/10 {
			t.Fatalf("jitter out of bounds: %v", x)
		}
	}
	if withJitter(d, 0) != d {
		t.Fatal("jitter with 0 pct should be equal")
	}
}

func TestDurationFromMs(t *testing.T) {
	if durationFromMs(0, 1234) != 1234*time.Millisecond {
		t.Fatal("default duration mismatch")
	}
	if durationFromMs(250, 0) != 250*time.Millisecond {
		t.Fatal("explicit duration mismatch")
	}
}

func TestRepeatsFor(t *testing.T) {
	if repeatsFor(models.TestCase{}) != 1 {
		t.Fatal("default repeats should be 1")
	}
	if repeatsFor(models.TestCase{Repeat: 2}) != 2 {
		t.Fatal("repeat honored")
	}
	if repeatsFor(models.TestCase{Repeat: 1, Retry: &models.Retry{Max: 3}}) != 3 {
		t.Fatal("retry max overrides")
	}
}

func TestGenerators(t *testing.T) {
	// UUID
	got := interpolate("${FAKE:uuid}", map[string]string{})
	if len(got) < 32 {
		t.Fatalf("uuid too short: %q", got)
	}
	// NOW
	got = interpolate("${NOW:2006}", map[string]string{})
	if len(got) != 4 {
		t.Fatalf("now year len: %q", got)
	}
	// NOW with offsets
	y := time.Now().Add(24 * time.Hour).Year()
	got = interpolate("${NOW+1d:2006}", map[string]string{})
	if got != fmt.Sprintf("%d", y) {
		t.Fatalf("NOW+1d year mismatch: %s vs %d", got, y)
	}
	y = time.Now().Add(-2 * time.Hour).Year()
	got = interpolate("${NOW-2h:2006}", map[string]string{})
	if got != fmt.Sprintf("%d", y) {
		t.Fatalf("NOW-2h year mismatch: %s vs %d", got, y)
	}
	// RANDINT
	ok := false
	for i := 0; i < 20; i++ {
		v := interpolate("n=${RANDINT:1:3}", map[string]string{})
		if v == "n=1" || v == "n=2" || v == "n=3" {
			ok = true
			break
		}
	}
	if !ok {
		t.Fatal("randint didn't produce values in range within attempts")
	}
	// EMAIL
	got = interpolate("user=${EMAIL}", map[string]string{})
	if !strings.Contains(got, "@example.com") {
		t.Fatalf("email not generated: %s", got)
	}
}
