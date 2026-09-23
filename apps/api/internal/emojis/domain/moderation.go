package domain

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrUnavailable = errors.New("unavailable")
var ErrForbidden = errors.New("forbidden")
var ErrInvalid = errors.New("invalid_input")
var ErrNotFound = errors.New("not_found")

type ManagedEmoji struct {
	ID, UserID                        int64
	Code, Status, ContentType, Reason string
	Width, Height                     int
	Animated                          bool
	TagIDs                            []int64
}
type Tag struct {
	ID       int64
	Name     string
	Triggers []string
}
type Moderation struct {
	Code, Status, Reason string
	TagIDs               []int64
}

var validCode = regexp.MustCompile(`^:[\p{Ll}\p{Nd}_]{2,30}:$`)

func NormalizeCode(s string) string {
	return ":" + strings.ToLower(strings.Trim(strings.TrimSpace(s), ":")) + ":"
}
func NormalizeModeration(v Moderation) (Moderation, error) {
	v.Code = NormalizeCode(v.Code)
	if !validCode.MatchString(v.Code) || utf8.RuneCountInString(v.Reason) > 500 {
		return v, ErrInvalid
	}
	switch v.Status {
	case "pending", "approved", "rejected":
	default:
		return v, ErrInvalid
	}
	if len(v.TagIDs) > 1000 {
		return v, ErrInvalid
	}
	return v, nil
}
func NormalizeTag(v Tag) (Tag, error) {
	v.Name = strings.ToLower(strings.TrimSpace(v.Name))
	if v.Name == "" || utf8.RuneCountInString(v.Name) > 40 {
		return v, ErrInvalid
	}
	seen := map[string]bool{}
	terms := []string{}
	for _, t := range v.Triggers {
		t = strings.ToLower(strings.TrimSpace(t))
		if t == "" || seen[t] {
			continue
		}
		if utf8.RuneCountInString(t) > 60 {
			return v, ErrInvalid
		}
		seen[t] = true
		terms = append(terms, t)
	}
	if len(terms) > 20 {
		return v, ErrInvalid
	}
	v.Triggers = terms
	return v, nil
}
