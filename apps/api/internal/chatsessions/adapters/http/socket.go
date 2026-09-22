package http

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
	rooms "chat/api/internal/rooms/domain"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type Projection interface {
	Presence(context.Context, string) ([]domain.Session, error)
}
type History interface {
	Recent(context.Context, string) ([]rooms.Message, error)
}
type SendMessage func(context.Context, domain.Session, string, string) (rooms.Message, error)
type Socket struct {
	service    application.Service
	projection Projection
	history    History
	send       SendMessage
	origin     string
}

func NewSocket(service application.Service, projection Projection, history History, send SendMessage, origin string) Socket {
	return Socket{service, projection, history, send, origin}
}
func (h Socket) Register(mux *http.ServeMux) { mux.HandleFunc("GET /api/v1/chat/socket", h.serve) }

type command struct {
	Type        string `json:"type"`
	ResumeToken string `json:"resume_token"`
	Visibility  string `json:"visibility"`
	ClientID    string `json:"client_id"`
	Body        string `json:"body"`
}
type peer struct {
	ID       string        `json:"id"`
	Nickname string        `json:"nickname"`
	Status   domain.Status `json:"status"`
}
type snapshot struct {
	Messages []messageDTO `json:"messages"`
	Peers    []peer       `json:"peers"`
}

func (h Socket) serve(w http.ResponseWriter, r *http.Request) {
	origin, err := url.Parse(h.origin)
	if err != nil || r.Host != origin.Host || r.Header.Get("Origin") != h.origin {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	conn.SetReadLimit(8192)
	authCtx, done := context.WithTimeout(ctx, 5*time.Second)
	var first command
	err = wsjson.Read(authCtx, conn, &first)
	done()
	credential, decodeErr := DecodeResume(first.ResumeToken)
	if err != nil || decodeErr != nil || first.Type != "resume" {
		_ = conn.Close(websocket.StatusPolicyViolation, "invalid_session")
		return
	}
	session, err := h.service.Restore(ctx, credential.SessionID, credential.IdentityKey, credential.Secret, time.Now())
	if err != nil {
		closeSessionError(conn, err)
		return
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		_, _ = h.service.Reconnect(cleanup, session.ID, session.IdentityKey, session.Generation, time.Now())
	}()
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return
	}
	initial, err := h.snapshot(ctx, session)
	if err != nil {
		return
	}
	if err := socketWrite(ctx, conn, map[string]any{"type": "ready", "connection_id": hex.EncodeToString(bytes), "session_id": session.ID, "nickname": session.Nickname, "generation": session.Generation, "snapshot": initial}); err != nil {
		return
	}
	h.run(ctx, conn, session, initial)
}
func (h Socket) run(ctx context.Context, conn *websocket.Conn, session domain.Session, initial snapshot) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	incoming := socketCommands(ctx, conn)
	updates := time.NewTicker(time.Second)
	defer updates.Stop()
	heartbeat := time.NewTicker(30 * time.Second)
	defer heartbeat.Stop()
	previous, _ := json.Marshal(initial)
	visibility := "visible"
	for {
		select {
		case <-ctx.Done():
			return
		case cmd, ok := <-incoming:
			if !ok {
				return
			}
			if cmd.Type == "heartbeat" {
				visibility = cmd.Visibility
			}
			if !h.command(ctx, conn, session, cmd, visibility) {
				return
			}
		case <-heartbeat.C:
			ping, done := context.WithTimeout(ctx, 10*time.Second)
			err := conn.Ping(ping)
			done()
			if err != nil || h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) != nil {
				return
			}
		case <-updates.C:
			current, err := h.snapshot(ctx, session)
			if err != nil {
				closeSessionError(conn, err)
				return
			}
			encoded, _ := json.Marshal(current)
			if string(encoded) != string(previous) {
				if socketWrite(ctx, conn, map[string]any{"type": "snapshot", "snapshot": current}) != nil {
					return
				}
				previous = encoded
			}
		}
	}
}
func (h Socket) command(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command, visibility string) bool {
	switch cmd.Type {
	case "heartbeat":
		return h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) == nil
	case "send":
		message, err := h.send(ctx, session, cmd.ClientID, cmd.Body)
		if err != nil {
			return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "message_rejected", "client_id": cmd.ClientID}) == nil
		}
		return socketWrite(ctx, conn, map[string]any{"type": "ack", "message": encodeMessage(message)}) == nil
	case "leave":
		if _, err := h.service.End(ctx, session.ID, session.IdentityKey, session.Generation, time.Now()); err != nil {
			return false
		}
		_ = socketWrite(ctx, conn, map[string]string{"type": "left"})
		_ = conn.Close(websocket.StatusNormalClosure, "left")
		return false
	default:
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "invalid_command"}) == nil
	}
}
func (h Socket) snapshot(ctx context.Context, session domain.Session) (snapshot, error) {
	sessions, err := h.projection.Presence(ctx, session.RoomID)
	if err != nil {
		return snapshot{}, err
	}
	peers := make([]peer, 0, len(sessions))
	current := false
	for _, value := range sessions {
		peers = append(peers, peer{value.ID, value.Nickname, value.Status})
		if value.ID == session.ID && value.Generation == session.Generation {
			current = true
		}
	}
	if !current {
		return snapshot{}, domain.ErrInvalidSession
	}
	messages, err := h.history.Recent(ctx, session.RoomID)
	encoded := make([]messageDTO, 0, len(messages))
	for _, message := range messages {
		encoded = append(encoded, encodeMessage(message))
	}
	return snapshot{encoded, peers}, err
}
func socketWrite(ctx context.Context, conn *websocket.Conn, value any) error {
	write, done := context.WithTimeout(ctx, 5*time.Second)
	defer done()
	return wsjson.Write(write, conn, value)
}

func closeSessionError(conn *websocket.Conn, err error) {
	if errors.Is(err, domain.ErrInvalidSession) {
		_ = conn.Close(websocket.StatusPolicyViolation, "session_ended")
	} else {
		_ = conn.Close(websocket.StatusInternalError, "unavailable")
	}
}

func socketCommands(ctx context.Context, conn *websocket.Conn) <-chan command {
	incoming := make(chan command, 1)
	go func() {
		defer close(incoming)
		for {
			var cmd command
			if wsjson.Read(ctx, conn, &cmd) != nil {
				return
			}
			select {
			case incoming <- cmd:
			case <-ctx.Done():
				return
			}
		}
	}()
	return incoming
}
