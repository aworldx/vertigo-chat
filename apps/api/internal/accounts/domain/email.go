package domain

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrEmailRequired = errors.New("email required")
var ErrEmailInvalid = errors.New("invalid email")
var ErrEmailTooLong = errors.New("email too long")
var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func ForumEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", ErrEmailRequired
	}
	if utf8.RuneCountInString(email) > 254 {
		return "", ErrEmailTooLong
	}
	if !emailPattern.MatchString(email) {
		return "", ErrEmailInvalid
	}
	return email, nil
}
