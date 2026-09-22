package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestForumEmail(t *testing.T) {
	for _, tc := range []struct {
		input, expected string
		err             error
	}{
		{"  User@Example.COM  ", "user@example.com", nil},
		{"ТЕСТ@ПОЧТА.РФ", "тест@почта.рф", nil},
		{"", "", ErrEmailRequired}, {" \n\t ", "", ErrEmailRequired},
		{"a@@b.c", "", ErrEmailInvalid}, {"a@b", "", ErrEmailInvalid}, {"a b@c.d", "", ErrEmailInvalid},
		{strings.Repeat("a", 248) + "@b.com", strings.Repeat("a", 248) + "@b.com", nil},
		{strings.Repeat("a", 249) + "@b.com", "", ErrEmailTooLong},
	} {
		got, err := ForumEmail(tc.input)
		if got != tc.expected || !errors.Is(err, tc.err) {
			t.Fatalf("%q: %q %v", tc.input, got, err)
		}
	}
}
