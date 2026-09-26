package http

import (
	"context"
	"sync"
	"time"

	chatlans "chat/api/internal/chatlans/application"
	"chat/api/internal/chatsessions/domain"
	rooms "chat/api/internal/rooms/domain"
)

// One bounded cache is shared by all sockets. Viewer-specific fields and live
// ephemeral events are rendered afterwards. Durable writes still validate the
// session against PostgreSQL; this cache never authorizes a command.
type roomSnapshot struct {
	sessions      []domain.Session
	presentations map[string]Presentation
	messages      []rooms.Message
	botBusy       bool
	bots          map[string]Presentation
}

type snapshotCache struct {
	mu    sync.Mutex
	room  string
	until time.Time
	value roomSnapshot
}

func (c *snapshotCache) invalidate() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.until = time.Time{}
}

func (h Socket) sharedSnapshot(ctx context.Context, viewer domain.Session) (roomSnapshot, error) {
	h.cache.mu.Lock()
	defer h.cache.mu.Unlock()
	if h.cache.room == viewer.RoomID && time.Now().Before(h.cache.until) && h.cache.value.contains(viewer) {
		return h.cache.value, nil
	}
	value, err := h.loadSnapshot(ctx, viewer.RoomID)
	if err == nil {
		h.cache.room, h.cache.value = viewer.RoomID, value
		h.cache.until = time.Now().Add(750 * time.Millisecond)
	}
	return value, err
}

func (r roomSnapshot) contains(viewer domain.Session) bool {
	for _, session := range r.sessions {
		if session.ID == viewer.ID && session.Generation == viewer.Generation {
			return true
		}
	}
	return false
}

func (h Socket) loadSnapshot(ctx context.Context, room string) (roomSnapshot, error) {
	value := roomSnapshot{presentations: map[string]Presentation{}}
	sessions, err := h.projection.Presence(ctx, room)
	if err != nil {
		return value, err
	}
	value.sessions = sessions
	for _, session := range sessions {
		presentation, err := h.presentation(ctx, session)
		if err != nil {
			return value, err
		}
		value.presentations[session.ID] = presentation
	}
	value.messages, err = h.history.Recent(ctx, room)
	if err != nil {
		return value, err
	}
	value.bots = map[string]Presentation{}
	for _, id := range []string{"hitchcock", "claire"} {
		p := Presentation{Preferences: chatlans.Default()}
		if h.experience.BotPresentation != nil {
			p, err = h.experience.BotPresentation(ctx, id)
			if err != nil {
				return value, err
			}
		}
		value.bots[id] = p
	}
	value.botBusy = h.experience.BotAvailable != nil && !h.experience.BotAvailable(ctx)
	return value, nil
}
