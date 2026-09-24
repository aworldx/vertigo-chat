package http

import (
	"chat/api/internal/chatsessions/domain"
	roomapp "chat/api/internal/rooms/application"
	rooms "chat/api/internal/rooms/domain"
	"context"
	"github.com/coder/websocket"
	"time"
)

func (h Socket) private(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	recipient, body, err := roomapp.ParsePrivate(session.Nickname, cmd.Body)
	if err != nil || cmd.ClientID == "" || len(cmd.ClientID) > 64 {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	if h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()) != nil {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	peers, err := h.projection.Presence(ctx, session.RoomID)
	if err != nil {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	var target domain.Session
	for _, peer := range peers {
		if peer.Nickname == recipient && peer.Status == domain.StatusActive {
			target = peer
			break
		}
	}
	if target.ID == "" {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	presentation, err := h.presentation(ctx, session)
	if err != nil {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	p := presentation.Preferences
	message := rooms.Message{ClientID: cmd.ClientID, Kind: "private", Author: session.Nickname, Recipient: recipient, Body: body, SentAt: time.Now().UTC(), FontID: p.Font, FontStyle: p.Style, Appearance: rooms.Appearance{Dark: rooms.Colors{Nickname: p.Appearance.Dark.Nickname, Text: p.Appearance.Dark.Text}, Light: rooms.Colors{Nickname: p.Appearance.Light.Nickname, Text: p.Appearance.Light.Text}}}
	delivered, ok := h.hub.direct(session, target, encodeMessage(message, session.IdentityKey))
	if !ok {
		return h.privateError(ctx, conn, cmd.ClientID)
	}
	return socketWrite(ctx, conn, map[string]any{"type": "ack", "message": delivered}) == nil
}
func (h Socket) privateError(ctx context.Context, conn *websocket.Conn, id string) bool {
	return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "private_unavailable", "client_id": id}) == nil
}
