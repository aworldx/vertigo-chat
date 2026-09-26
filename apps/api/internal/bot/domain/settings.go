package domain

import (
	"errors"
	"regexp"
	"strings"
)

var ErrInvalidSettings = errors.New("invalid bot settings")

type Limits struct{ DailyTokens, StopPercent int }

func (l Limits) Valid() bool {
	return l.DailyTokens >= 0 && l.DailyTokens <= 1000000000 && l.StopPercent >= 1 && l.StopPercent <= 100
}

type Colors struct{ Nickname, Text string }
type Style struct {
	Dark, Light     Colors
	Font, FontStyle string
}

func DefaultStyle() Style {
	return Style{Dark: Colors{"#fcd34d", "#e4e4e7"}, Light: Colors{"#9a3412", "#1f2937"}, Font: "theme", FontStyle: "normal"}
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func (s Style) Valid() bool {
	colors := hexColor.MatchString(s.Dark.Nickname) && hexColor.MatchString(s.Dark.Text) && hexColor.MatchString(s.Light.Nickname) && hexColor.MatchString(s.Light.Text)
	font := s.Font == "theme" || s.Font == "sans" || s.Font == "display" || s.Font == "serif"
	return colors && font && (s.FontStyle == "normal" || s.FontStyle == "italic")
}
func KnownBot(id string) bool { return id == "hitchcock" || id == "claire" }

func (s Style) Normalize() Style {
	s.Dark.Nickname = strings.ToLower(s.Dark.Nickname)
	s.Dark.Text = strings.ToLower(s.Dark.Text)
	s.Light.Nickname = strings.ToLower(s.Light.Nickname)
	s.Light.Text = strings.ToLower(s.Light.Text)
	return s
}
