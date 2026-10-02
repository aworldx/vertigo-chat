package domain

import (
	"strings"
	"testing"
)

func TestNormalizePollInput(t *testing.T) {
	got, err := Normalize(Input{Question: "  Какой фильм?  ", Options: []string{"  Первый ", "Второй  "}})
	if err != nil || got.Question != "Какой фильм?" || got.Options[0] != "Первый" {
		t.Fatalf("normalized input: %#v, %v", got, err)
	}
	for _, input := range []Input{
		{Question: "", Options: []string{"a", "b"}},
		{Question: "q", Options: []string{"a"}},
		{Question: "q", Options: []string{"a", ""}},
		{Question: strings.Repeat("я", 501), Options: []string{"a", "b"}},
		{Question: "q", Options: []string{strings.Repeat("я", 201), "b"}},
	} {
		if _, err := Normalize(input); err != ErrInvalid {
			t.Fatalf("expected invalid for %#v, got %v", input, err)
		}
	}
}
