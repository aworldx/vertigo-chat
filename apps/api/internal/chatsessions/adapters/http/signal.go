package http

import (
	"chat/api/internal/chatsessions/domain"
	shares "chat/api/internal/mediashares/application"
	"context"
	"encoding/base64"
	"encoding/json"
	"github.com/coder/websocket"
	"strings"
	"time"
)

type mediaSignal struct {
	shares.Share
	SDP   string `json:"sdp"`
	Data  string `json:"data"`
	Index int    `json:"index"`
	Total int    `json:"total"`
}

func (h Socket) signal(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	var value mediaSignal
	if json.Unmarshal([]byte(cmd.Body), &value) != nil || len(cmd.Body) > 31000 || len(value.ID) != 36 {
		return false
	}
	if h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, "visible", time.Now()) != nil {
		return false
	}
	if value.Type == "announce" {
		return h.announce(ctx, conn, session, value)
	}
	if !h.allowedSignal(session, cmd.Target, value) {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "signal_rejected"}) == nil
	}
	peers, err := h.projection.Presence(ctx, session.RoomID)
	if err != nil {
		return false
	}
	for _, peer := range peers {
		if peer.ID == cmd.Target && peer.ID != session.ID && peer.Status == domain.StatusActive {
			h.hub.relay(session, peer, messageDTO{Kind: "signal", Author: session.ID, Body: cmd.Body})
			return true
		}
	}
	return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "peer_unavailable"}) == nil
}
func (h Socket) allowedSignal(s domain.Session, target string, v mediaSignal) bool {
	if v.Type == "request" || v.Type == "relay_request" {
		return h.shares.Request(v.ID, s.RoomID, target, s.ID)
	}
	if !h.shares.Authorize(v.ID, s.RoomID, s.ID, target) {
		return false
	}
	switch v.Type {
	case "offer", "answer":
		return v.SDP != "" && len(v.SDP) <= 30000
	case "relay_ack":
		return true
	case "relay_chunk":
		data, err := base64.StdEncoding.DecodeString(v.Data)
		return err == nil && len(v.Data) <= 24000 && h.shares.Chunk(v.ID, s.RoomID, s.ID, target, v.Index, v.Total, len(data))
	}
	return false
}
func (h Socket) announce(ctx context.Context, conn *websocket.Conn, s domain.Session, v mediaSignal) bool {
	v.Owner = s.ID
	v.Room = s.RoomID
	if !strings.HasPrefix(s.IdentityKey, "user:") || !h.limiter.Media(s.IdentityKey, time.Now()) || !h.shares.Announce(v.Share) {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "media_rejected"}) == nil
	}
	raw, _ := json.Marshal(v.Share)
	peers, err := h.projection.Presence(ctx, s.RoomID)
	if err != nil {
		return false
	}
	for _, peer := range peers {
		if peer.ID != s.ID {
			h.hub.relay(s, peer, messageDTO{Kind: "signal", Author: s.ID, Body: string(raw)})
		}
	}
	return true
}
func (h *hub) relay(sender, recipient domain.Session, message messageDTO) {
	h.mu.Lock()
	defer h.mu.Unlock()
	target := h.listeners[recipient.ID]
	source := h.listeners[sender.ID]
	if target == nil || source == nil || target.session.Generation != recipient.Generation || source.session.Generation != sender.Generation {
		return
	}
	select {
	case target.events <- message:
	default:
	}
}
