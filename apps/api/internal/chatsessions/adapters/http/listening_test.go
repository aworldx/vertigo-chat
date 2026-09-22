package http

import (
	"chat/api/internal/chatsessions/domain"
	"strings"
	"testing"
)

func TestListeningFencingAndStaleStop(t *testing.T) {
	h := newHub()
	s := domain.Session{ID: "one", Generation: 1}
	_, stop := h.subscribe(s)
	h.setListening(s, "first", true)
	h.setListening(s, "second", true)
	h.setListening(s, "first", false)
	if h.listening(s) != "second" {
		t.Fatal("stale pause removed current track")
	}
	old := s
	old.Generation = 0
	h.setListening(old, "forged", true)
	if h.listening(s) != "second" {
		t.Fatal("stale generation wrote track")
	}
	h.setListening(s, strings.Repeat("я", 250), true)
	if len([]rune(h.listening(s))) != 200 {
		t.Fatal("title length")
	}
	stop()
	if h.listening(s) != "" {
		t.Fatal("disconnected presence retained track")
	}
}
