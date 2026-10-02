package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalid   = errors.New("invalid_poll")
	ErrNotFound  = errors.New("poll_not_found")
	ErrClosed    = errors.New("poll_closed")
	ErrVoted     = errors.New("already_voted")
	ErrForbidden = errors.New("forbidden")
)

type Input struct {
	Question string   `json:"question"`
	Options  []string `json:"options"`
}
type Option struct {
	ID       int64  `json:"id"`
	Body     string `json:"body"`
	Position int    `json:"position"`
	Votes    int    `json:"votes"`
}
type Poll struct {
	ID               int64      `json:"id"`
	Question         string     `json:"question"`
	Status           string     `json:"status"`
	Options          []Option   `json:"options"`
	TotalVotes       int        `json:"totalVotes"`
	SelectedOptionID int64      `json:"selectedOptionID"`
	CreatedAt        time.Time  `json:"createdAt"`
	ClosedAt         *time.Time `json:"closedAt"`
}

func Normalize(v Input) (Input, error) {
	v.Question = strings.TrimSpace(v.Question)
	if !utf8.ValidString(v.Question) || v.Question == "" || utf8.RuneCountInString(v.Question) > 500 || len(v.Options) < 2 || len(v.Options) > 10 {
		return v, ErrInvalid
	}
	for i := range v.Options {
		v.Options[i] = strings.TrimSpace(v.Options[i])
		if !utf8.ValidString(v.Options[i]) || v.Options[i] == "" || utf8.RuneCountInString(v.Options[i]) > 200 {
			return v, ErrInvalid
		}
	}
	return v, nil
}
