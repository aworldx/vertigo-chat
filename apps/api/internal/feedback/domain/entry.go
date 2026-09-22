package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

var ErrInvalid = errors.New("invalid feedback")
var ErrLimited = errors.New("feedback rate limited")

type Entry struct {
	UserID               int64
	Name, Body, Identity string
}

func Normalize(e Entry) (Entry, error) {
	e.Name = strings.TrimSpace(e.Name)
	e.Body = strings.TrimSpace(e.Body)
	if utf8.RuneCountInString(e.Name) < 2 || utf8.RuneCountInString(e.Name) > 40 || utf8.RuneCountInString(e.Body) < 3 || utf8.RuneCountInString(e.Body) > 2000 {
		return e, ErrInvalid
	}
	return e, nil
}
