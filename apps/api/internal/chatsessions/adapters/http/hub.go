package http

import (
	"chat/api/internal/chatsessions/domain"
	shares "chat/api/internal/mediashares/application"
	"sort"
	"sync"
	"time"
)

// hub carries only ephemeral transport events. Durable sessions remain authoritative.
type subscription struct {
	session     domain.Session
	events      chan messageDTO
	typingUntil time.Time
	track       string
}
type hub struct {
	mu        sync.Mutex
	listeners map[string]*subscription
	sent      map[string]messageDTO
	sequence  int64
}

func newHub() *hub {
	return &hub{listeners: map[string]*subscription{}, sent: map[string]messageDTO{}}
}
func (h *hub) subscribe(session domain.Session) (<-chan messageDTO, func()) {
	sub := &subscription{session: session, events: make(chan messageDTO, 64)}
	h.mu.Lock()
	h.listeners[session.ID] = sub
	h.mu.Unlock()
	return sub.events, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if h.listeners[session.ID] == sub {
			delete(h.listeners, session.ID)
		}
	}
}
func (h *hub) direct(sender, recipient domain.Session, message messageDTO) (messageDTO, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	key := sender.IdentityKey + ":" + message.ClientID
	if previous, ok := h.sent[key]; ok {
		return previous, true
	}
	target := h.listeners[recipient.ID]
	source := h.listeners[sender.ID]
	if target == nil || target.session.Generation != recipient.Generation || source == nil || source.session.Generation != sender.Generation {
		return message, false
	}
	now := time.Now()
	h.sequence = max(h.sequence+1, now.UnixMicro())
	message.ID = -h.sequence
	select {
	case target.events <- message:
		if len(h.sent) >= 1024 {
			h.sent = map[string]messageDTO{}
		}
		h.sent[key] = message
		return message, true
	default:
		return message, false
	}
}
func (h *hub) setTyping(session domain.Session, active bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	sub := h.listeners[session.ID]
	if sub == nil || sub.session.Generation != session.Generation {
		return
	}
	sub.typingUntil = time.Time{}
	if active {
		sub.typingUntil = time.Now().Add(5 * time.Second)
	}
}
func (h *hub) typing(viewer domain.Session) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	result := make([]string, 0)
	for _, sub := range h.listeners {
		if sub.session.RoomID == viewer.RoomID && sub.session.ID != viewer.ID && sub.typingUntil.After(time.Now()) {
			result = append(result, sub.session.Nickname)
		}
	}
	sort.Strings(result)
	return result
}

func (h *hub) closeShares(session domain.Session, registry *shares.Registry) {
	h.mu.Lock()
	defer h.mu.Unlock()
	current := h.listeners[session.ID]
	if current != nil && current.session.Generation == session.Generation {
		registry.Close(session.ID)
	}
}
