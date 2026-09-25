package domain

import (
	_ "embed"
	"strings"
)

//go:embed claire.txt
var ClaireInstructions string

type Persona struct{ ID, Name, Instructions, Fallback string }

func Hitchcock() Persona {
	return Persona{"hitchcock", "Хичкок", Instructions, "Что-то ответ не отправился. Повторишь?"}
}
func Claire() Persona {
	return Persona{"claire", "Клэр", ClaireInstructions, "Ой, потеряла мысль. Повтори, пожалуйста?"}
}
func Addressed(body string) (Persona, bool) {
	for _, p := range []Persona{Hitchcock(), Claire()} {
		if strings.HasPrefix(body, p.Name+",") {
			return p, true
		}
	}
	return Persona{}, false
}

// MediaSuggestion accepts only a final allowlisted search command, never URLs or code.
func MediaSuggestion(text string) (body, kind, query string) {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	last := strings.TrimSpace(lines[len(lines)-1])
	for command, media := range map[string]string{"/music ": "music", "/video ": "youtube"} {
		if strings.HasPrefix(last, command) {
			query = strings.TrimSpace(strings.TrimPrefix(last, command))
			body = strings.TrimSpace(strings.Join(lines[:len(lines)-1], "\n"))
			if body != "" && query != "" && len([]rune(query)) <= 120 && !strings.Contains(query, "://") {
				return body, media, query
			}
			return body, "", ""
		}
	}
	return text, "", ""
}
