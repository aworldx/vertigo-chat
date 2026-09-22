package domain

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

type Share struct {
	ID    string `json:"id"`
	Type  string `json:"type"`
	Name  string `json:"name"`
	MIME  string `json:"mime"`
	Size  int    `json:"size"`
	Owner string `json:"-"`
	Room  string `json:"-"`
}

var uuid = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func Valid(s Share) bool {
	if !uuid.MatchString(s.ID) || strings.TrimSpace(s.Name) == "" || utf8.RuneCountInString(s.Name) > 120 || s.Size <= 0 {
		return false
	}
	switch s.MIME {
	case "image/jpeg", "image/png", "image/webp":
		return s.Size <= 5_000_000
	case "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/aac":
		return s.Size <= 50_000_000
	}
	return false
}
