package domain

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrInvalid = errors.New("invalid_article")
var ErrForbidden = errors.New("forbidden")
var ErrNotFound = errors.New("not_found")
var ErrRank = errors.New("kinoman_required")
var ErrTotal = errors.New("article_limit_reached")
var ErrDaily = errors.New("daily_article_limit_reached")

type Input struct {
	Title, Body, Series string
	Part                *int
}
type Article struct {
	ID, UserID int64
	Input
	InsertedAt time.Time
}
type Series struct {
	UserID int64
	Name   string
	Count  int
}

func Normalize(v Input) (Input, error) {
	v.Title = strings.TrimSpace(v.Title)
	v.Body = strings.TrimSpace(v.Body)
	v.Series = strings.TrimSpace(v.Series)
	if !valid(v.Title, 160, true) || !valid(v.Body, 12000, true) || !valid(v.Series, 120, false) {
		return v, ErrInvalid
	}
	if v.Part != nil && (*v.Part < 1 || *v.Part > 999) {
		return v, ErrInvalid
	}
	if v.Series == "" {
		v.Part = nil
	}
	return v, nil
}
func valid(s string, max int, required bool) bool {
	return utf8.ValidString(s) && utf8.RuneCountInString(s) <= max && (!required || s != "")
}
func Quota(allowed bool, total, daily int) error {
	if !allowed {
		return ErrRank
	}
	if total >= 50 {
		return ErrTotal
	}
	if daily >= 10 {
		return ErrDaily
	}
	return nil
}
