package domain

import "testing"

func TestNormalizeHostilePreferenceValues(t *testing.T) {
	p := Normalize(Preferences{Theme: "unknown", Font: "script", Style: "bold", Appearance: Appearance{Dark: Colors{Nickname: "url(javascript:alert(1))", Text: "#ABCDEF"}}})
	if p.Theme != "vertigo" || p.Font != "theme" || p.Style != "normal" || p.Appearance.Dark.Nickname != "#fcd34d" || p.Appearance.Dark.Text != "#abcdef" || p.Appearance.Frame == nil || !*p.Appearance.Frame {
		t.Fatal(p)
	}
}
