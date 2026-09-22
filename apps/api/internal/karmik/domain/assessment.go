package domain

import (
	_ "embed"
	"errors"
	"strings"
	"unicode/utf8"
)

//go:embed instructions.txt
var Instructions string
var ErrInvalid = errors.New("invalid assessment")

type Message struct {
	ID     int64  `json:"id"`
	Author string `json:"author"`
	Body   string `json:"body"`
	UserID int64  `json:"-"`
}
type Input struct {
	Messages    []Message `json:"messages"`
	EligibleIDs []int64   `json:"eligible_message_ids"`
	Context     []Message `json:"context"`
}
type Assessment struct {
	MessageID int64  `json:"message_id"`
	Verdict   string `json:"verdict"`
	Reason    string `json:"reason"`
}
type Usage struct {
	Input  int
	Output int
	Total  int
}

func Validate(assessments []Assessment, eligible map[int64]Message) error {
	seen := map[int64]bool{}
	if len(assessments) > 12 {
		return ErrInvalid
	}
	for _, a := range assessments {
		m, ok := eligible[a.MessageID]
		if !ok || seen[m.UserID] || strings.TrimSpace(a.Reason) == "" || utf8.RuneCountInString(a.Reason) > 300 || (a.Verdict != "good" && a.Verdict != "bad" && a.Verdict != "neutral") {
			return ErrInvalid
		}
		seen[m.UserID] = true
	}
	return nil
}
func Delta(verdict string) int {
	if verdict == "good" {
		return 1
	}
	if verdict == "bad" {
		return -1
	}
	return 0
}
