package domain

import "testing"

func TestNormalizeHostilePreferenceValues(t *testing.T) {
	p := Normalize(Preferences{Theme: "unknown", Font: "script", Style: "bold", Appearance: Appearance{Dark: Colors{Nickname: "url(javascript:alert(1))", Text: "#ABCDEF"}}})
	if p.Theme != "autumn" || p.Font != "theme" || p.Style != "normal" || p.Appearance.Dark.Nickname != "#fcd34d" || p.Appearance.Dark.Text != "#abcdef" || p.Appearance.Frame == nil || !*p.Appearance.Frame {
		t.Fatal(p)
	}
}

func TestNormalizePreservesAutumnTheme(t *testing.T) {
	p := Normalize(Preferences{Theme: "autumn"})
	if p.Theme != "autumn" {
		t.Fatalf("autumn selection was replaced with %q", p.Theme)
	}
}

func TestDefaultThemePreservesExplicitChoice(t *testing.T) {
	if Normalize(Preferences{}).Theme != "autumn" {
		t.Fatal("new guests must use autumn")
	}
	if Normalize(Preferences{Theme: "vertigo"}).Theme != "vertigo" {
		t.Fatal("explicit existing theme must be preserved")
	}
}

func TestNormalizePreservesSunnyAutumn(t *testing.T) {
	if Normalize(Preferences{Theme: "autumn_sunny"}).Theme != "autumn_sunny" {
		t.Fatal("sunny autumn selection must be preserved")
	}
}
