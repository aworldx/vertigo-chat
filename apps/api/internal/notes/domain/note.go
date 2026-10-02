package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalid   = errors.New("invalid_note")
	ErrRecipient = errors.New("recipient_not_found")
	ErrDaily     = errors.New("note_daily_limit")
)

type Input struct{ Recipient, Body string }

type Note struct {
	ID                int64
	Sender, Recipient string
	Body              string
	ReadAt            *time.Time
	InsertedAt        time.Time
}

func Normalize(v Input) (Input, error) {
	v.Recipient = strings.TrimSpace(v.Recipient)
	v.Body = strings.TrimSpace(v.Body)
	if !utf8.ValidString(v.Recipient) || !utf8.ValidString(v.Body) || v.Recipient == "" || v.Body == "" || utf8.RuneCountInString(v.Recipient) > 40 || utf8.RuneCountInString(v.Body) > 1000 {
		return v, ErrInvalid
	}
	return v, nil
}
