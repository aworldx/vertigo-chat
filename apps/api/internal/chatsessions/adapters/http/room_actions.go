package http

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"github.com/coder/websocket"
)

func (h Socket) roomAction(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	var err error
	switch cmd.Type {
	case "reaction":
		if h.experience.React == nil {
			return false
		}
		err = h.experience.React(ctx, session, cmd.MessageID, cmd.Emoji, cmd.Active)
	case "delete":
		if h.experience.Delete == nil {
			return false
		}
		err = h.experience.Delete(ctx, session, cmd.MessageID)
	}
	if err != nil {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "action_rejected"}) == nil
	}
	current, err := h.snapshot(ctx, session)
	if err != nil {
		return false
	}
	return socketWrite(ctx, conn, map[string]any{"type": "snapshot", "snapshot": current}) == nil
}
