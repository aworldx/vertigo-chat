package domain

import "testing"

func TestPersonasAndMediaSuggestions(t *testing.T) {
	for _, p := range []Persona{Hitchcock(), Claire()} {
		got, ok := Addressed(p.Name + ", привет")
		if !ok || got.ID != p.ID || p.Instructions == "" || p.Fallback == "" {
			t.Fatal(got)
		}
	}
	if _, ok := Addressed("поговорим о Клэр"); ok {
		t.Fatal("unaddressed message")
	}
	for _, tc := range []struct{ text, body, kind, query string }{
		{"Привет", "Привет", "", ""},
		{"Люблю эту песню\n/music ABBA - Dancing Queen", "Люблю эту песню", "music", "ABBA - Dancing Queen"},
		{"Для настроения\n\n \t/music Claude Debussy - Clair de Lune", "Для настроения", "music", "Claude Debussy - Clair de Lune"},
		{"Посмотрим?\n  /video Beatles  ", "Посмотрим?", "youtube", "Beatles"},
		{"Посмотрим?\n/video Beatles", "Посмотрим?", "youtube", "Beatles"},
		{"Песня\n/music https://evil.test", "Песня", "", ""},
		{"Песня\n/music ", "Песня\n/music ", "", ""},
		{"/delete all", "/delete all", "", ""},
	} {
		body, kind, query := MediaSuggestion(tc.text)
		if body != tc.body || kind != tc.kind || query != tc.query {
			t.Fatalf("%q => %q %q %q", tc.text, body, kind, query)
		}
	}
}
