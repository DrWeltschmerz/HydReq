package ui

import (
	"fmt"
	"os"
	"time"
)

const (
	Reset  = "\033[0m"
	Bold   = "\033[1m"
	Dim    = "\033[2m"
	Red    = "\033[31m"
	Green  = "\033[32m"
	Yellow = "\033[33m"
	Blue   = "\033[34m"
	Gray   = "\033[90m"
)

func Successf(format string, a ...any) {
	if !Enabled {
		return
	}
	fmt.Printf(Green+"✓ "+Reset+format+"\n", a...)
}
func Failf(format string, a ...any) {
	if !Enabled {
		return
	}
	fmt.Printf(Red+"✗ "+Reset+format+"\n", a...)
}

// FailWithBoldPrefix prints an error with a bold, red prefix and a normal-colored message.
// Example: ✗ <bold>load suite testdata/x.hrq.yaml:</bold> yaml parse error
func FailWithBoldPrefix(prefix string, format string, a ...any) {
	if !Enabled {
		return
	}
	// Red exclamation, bold red prefix, reset, then message
	fmt.Print(Red + "✗ " + Bold + prefix + ":" + Reset + " ")
	fmt.Printf(format+"\n", a...)
}
func Skipf(format string, a ...any) {
	if !Enabled {
		return
	}
	fmt.Printf(Gray+"- "+Reset+format+"\n", a...)
}
func Infof(format string, a ...any) {
	if !Enabled {
		return
	}
	fmt.Printf(Blue+format+Reset+"\n", a...)
}
func Detail(msg string) {
	if !Enabled {
		return
	}
	fmt.Println(Gray + "  - " + msg + Reset)
}
func CodeBlock(s string) {
	if !Enabled {
		return
	}
	fmt.Println(Gray + indent(s, "  ") + Reset)
}

func Summary(total, passed, failed, skipped int, d time.Duration) {
	if !Enabled {
		return
	}
	fmt.Print("\n")
	fmt.Printf(Bold+"Summary:"+Reset+" total=%d ", total)
	fmt.Printf(Green+"passed=%d "+Reset, passed)
	if failed > 0 {
		fmt.Printf(Red+"failed=%d "+Reset, failed)
	} else {
		fmt.Printf("failed=%d ", failed)
	}
	if skipped > 0 {
		fmt.Printf(Yellow+"skipped=%d "+Reset, skipped)
	} else {
		fmt.Printf("skipped=%d ", skipped)
	}
	fmt.Printf("in %s\n", d.Truncate(time.Millisecond))
}

// SuiteHeader prints a bold suite title above its tests
func SuiteHeader(name string) {
	if !Enabled {
		return
	}
	// One blank line before header is handled by caller when needed
	fmt.Printf(Bold+"%s"+Reset+"\n", name)
}

// SuiteSeparator prints a single blank line between suites
func SuiteSeparator() {
	if !Enabled {
		return
	}
	fmt.Println()
}

// IsTTY reports whether stdout is a terminal
func IsTTY() bool {
	fi, err := os.Stdout.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}

// Banner is a minimal single-line name for CLI output
var Banner = "HydReq — Hydra Request"

func PrintBanner() { fmt.Println(Blue + Banner + Reset) }

// Enabled controls whether UI prints to stdout (useful for TUI embedding)
var Enabled = true

// Deprecated: BannerLarge is removed to keep CLI output clean.

func indent(s, pad string) string {
	out := ""
	for i, r := range s {
		if i == 0 {
			out += pad
		}
		out += string(r)
		if r == '\n' {
			out += pad
		}
	}
	return out
}
