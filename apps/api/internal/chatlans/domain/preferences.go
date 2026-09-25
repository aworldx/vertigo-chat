// Package domain owns the public appearance of a chat participant.
package domain

import (
	"regexp"
	"strings"
)

type Colors struct {
	Nickname string `json:"nickname_color"`
	Text     string `json:"text_color"`
}
type Appearance struct {
	Dark       Colors `json:"dark"`
	Light      Colors `json:"light"`
	Frame      *bool  `json:"message_frame,omitempty"`
	HideKarmik bool   `json:"hide_karmik"`
}
type Preferences struct {
	Theme      string     `json:"theme_id"`
	Appearance Appearance `json:"appearance"`
	Font       string     `json:"font_id"`
	Style      string     `json:"font_style"`
	Sound      bool       `json:"message_sound_enabled"`
}

var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func color(value, fallback string) string {
	if colorPattern.MatchString(value) {
		return strings.ToLower(value)
	}
	return fallback
}
func Normalize(p Preferences) Preferences {
	switch p.Theme {
	case "vertigo", "dark", "night_sky", "autumn", "autumn_sunny", "newspaper":
	case "light":
		p.Theme = "newspaper"
	default:
		p.Theme = "autumn"
	}
	switch p.Font {
	case "sans", "display", "serif":
	default:
		p.Font = "theme"
	}
	if p.Style != "italic" {
		p.Style = "normal"
	}
	p.Appearance.Dark = Colors{color(p.Appearance.Dark.Nickname, "#fcd34d"), color(p.Appearance.Dark.Text, "#e4e4e7")}
	p.Appearance.Light = Colors{color(p.Appearance.Light.Nickname, "#9a3412"), color(p.Appearance.Light.Text, "#1f2937")}
	if p.Appearance.Frame == nil {
		frame := true
		p.Appearance.Frame = &frame
	}
	return p
}
