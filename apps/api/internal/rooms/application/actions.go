package application

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrActionDenied = errors.New("room action denied")
var ReactionEmojis = []string{"👍", "❤️", "😂", "😮", "😢", "🔥"}

type ActionStore interface {
	Reaction(context.Context, string, int64, string, string, string, bool) error
	Delete(context.Context, string, int64) error
}
type Actions struct{ store ActionStore }

func NewActions(store ActionStore) Actions { return Actions{store} }
func (a Actions) React(ctx context.Context, room string, id int64, identity, nickname, emoji string, active bool) error {
	valid := false
	for _, value := range ReactionEmojis {
		if value == emoji {
			valid = true
		}
	}
	if !valid || id <= 0 {
		return ErrActionDenied
	}
	return a.store.Reaction(ctx, room, id, identity, nickname, emoji, active)
}
func (a Actions) Delete(ctx context.Context, room string, id int64, admin bool) error {
	if !admin || id <= 0 {
		return ErrActionDenied
	}
	return a.store.Delete(ctx, room, id)
}

var privatePattern = regexp.MustCompile(`^\^([\p{L}\p{N}_-]{3,24}),?\s+(.+)$`)

func ParsePrivate(author, body string) (string, string, error) {
	parts := privatePattern.FindStringSubmatch(strings.TrimSpace(body))
	if len(parts) != 3 || parts[1] == author {
		return "", "", ErrInvalidMessage
	}
	text := strings.TrimSpace(parts[2])
	if text == "" || utf8.RuneCountInString(text) > 1000 {
		return "", "", ErrInvalidMessage
	}
	return parts[1], text, nil
}
