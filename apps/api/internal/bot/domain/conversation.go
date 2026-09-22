package domain

import (
	_ "embed"
	"errors"
	"time"
)

//go:embed instructions.txt
var Instructions string
var ErrUnavailable = errors.New("bot unavailable")
var ErrEmptyResponse = errors.New("empty bot response")

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type Request struct{ ID, Identity, Nickname, Body string }
type Context struct {
	Messages         []Message
	Memory, Identity string
	Date             string
	Summarize        bool
}
type Result struct {
	Fallback             bool
	Text                 string
	Input, Output, Total int
	PlanningDate         string
}

type RateLimited struct{ RetryAfter time.Duration }

func (RateLimited) Error() string { return "bot provider rate limited" }
