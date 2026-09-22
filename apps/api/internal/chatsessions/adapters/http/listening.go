package http

import (
	"chat/api/internal/chatsessions/domain"
	"strings"
)

func (h *hub) setListening(session domain.Session, track string, active bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	sub := h.listeners[session.ID]
	if sub == nil || sub.session.Generation != session.Generation {
		return
	}
	text := []rune(strings.TrimSpace(track))
	if len(text) > 200 {
		text = text[:200]
	}
	normalized := string(text)
	if active && normalized != "" {
		sub.track = normalized
	} else if !active && (normalized == "" || sub.track == normalized) {
		sub.track = ""
	}
}
func (h *hub) listening(session domain.Session) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	sub := h.listeners[session.ID]
	if sub == nil || sub.session.Generation != session.Generation {
		return ""
	}
	return sub.track
}
