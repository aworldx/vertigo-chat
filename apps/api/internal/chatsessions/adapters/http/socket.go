package http

import (
	media "chat/api/internal/mediasearch/application"
	shares "chat/api/internal/mediashares/application"
	security "chat/api/internal/security/application"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	chatlans "chat/api/internal/chatlans/application"
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
	shares     *shares.Registry
	limiter    *security.Limiter
	clientIP   string
	service    application.Service
	projection Projection
	history    History
	send       SendMessage
	origin     string
	experience Experience
	hub        *hub
}

func NewSocket(service application.Service, projection Projection, history History, send SendMessage, origin string) Socket {
	return Socket{service: service, projection: projection, history: history, send: send, origin: origin, hub: newHub(), limiter: security.NewLimiter(), shares: shares.NewRegistry()}
}
func (h Socket) Register(mux *http.ServeMux) { mux.HandleFunc("GET /api/v1/chat/socket", h.serve) }

type command struct {
	Media       media.Item           `json:"media"`
	Target      string               `json:"target"`
	MessageID   int64                `json:"message_id"`
	Emoji       string               `json:"emoji"`
	Active      bool                 `json:"active"`
	Type        string               `json:"type"`
	ResumeToken string               `json:"resume_token"`
	Visibility  string               `json:"visibility"`
	ClientID    string               `json:"client_id"`
	Body        string               `json:"body"`
	Preferences chatlans.Preferences `json:"preferences"`
}
type peer struct {
	BotBusy        bool                 `json:"bot_busy,omitempty"`
	ListeningTrack string               `json:"listening_track,omitempty"`
	Bot            bool                 `json:"bot"`
	ID             string               `json:"id"`
	Nickname       string               `json:"nickname"`
	Status         domain.Status        `json:"status"`
	Registered     bool                 `json:"registered"`
	Self           bool                 `json:"self"`
	Preferences    chatlans.Preferences `json:"preferences"`
	Rank           *Rank                `json:"rank"`
}
type snapshot struct {
	Typing      []string             `json:"typing"`
	Messages    []messageDTO         `json:"messages"`
	Peers       []peer               `json:"peers"`
	Preferences chatlans.Preferences `json:"preferences"`
	Admin       bool                 `json:"admin"`
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
	conn.SetReadLimit(32768)
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
	events, unsubscribe := h.hub.subscribe(session)
	defer unsubscribe()
	defer h.hub.closeShares(session, h.shares)
	initial, err := h.snapshot(ctx, session)
	if err != nil {
		return
	}
	if err := socketWrite(ctx, conn, map[string]any{"type": "ready", "connection_id": hex.EncodeToString(bytes), "session_id": session.ID, "nickname": session.Nickname, "generation": session.Generation, "snapshot": initial}); err != nil {
		return
	}
	h.clientIP, _, _ = net.SplitHostPort(r.RemoteAddr)
	h.run(ctx, conn, session, initial, events)
}
func (h Socket) run(ctx context.Context, conn *websocket.Conn, session domain.Session, initial snapshot, events <-chan messageDTO) {
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
		case event := <-events:
			if h.writeEvent(ctx, conn, event) != nil {
				return
			}
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
			if !h.heartbeat(ctx, conn, session, visibility) {
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
	if h.messageLimited(session, cmd) {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "rate_limited", "client_id": cmd.ClientID}) == nil
	}
	switch cmd.Type {
	case "listening":
		if h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) != nil {
			return false
		}
		h.hub.setListening(session, cmd.Body, cmd.Active)
		return true
	case "media":
		return h.media(ctx, conn, session, cmd)
	case "signal":
		return h.signal(ctx, conn, session, cmd)
	case "reaction", "delete":
		return h.roomAction(ctx, conn, session, cmd)
	case "preferences":
		return h.preferences(ctx, conn, session, cmd)
	case "heartbeat":
		return h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) == nil
	case "typing":
		if h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) != nil {
			return false
		}
		h.hub.setTyping(session, cmd.Active)
		return true
	case "send":
		return h.sendCommand(ctx, conn, session, cmd)
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
	own := Presentation{Preferences: chatlans.Default()}
	for _, value := range sessions {
		presentation, err := h.presentation(ctx, value)
		if err != nil {
			return snapshot{}, err
		}
		peers = append(peers, peer{ListeningTrack: h.hub.listening(value), ID: value.ID, Nickname: value.Nickname, Status: value.Status, Registered: strings.HasPrefix(value.IdentityKey, "user:"), Self: value.ID == session.ID, Preferences: presentation.Preferences, Rank: presentation.Rank})
		if value.ID == session.ID {
			own = presentation
		}
		if value.ID == session.ID && value.Generation == session.Generation {
			current = true
		}
	}
	if !current {
		return snapshot{}, domain.ErrInvalidSession
	}
	peers = append(peers, peer{BotBusy: h.experience.BotAvailable != nil && !h.experience.BotAvailable(ctx), ID: "bot-hitchcock", Nickname: "Хичкок", Status: domain.StatusActive, Preferences: chatlans.Default(), Bot: true})
	sort.Slice(peers, func(i, j int) bool { return peers[i].Nickname < peers[j].Nickname })
	messages, err := h.history.Recent(ctx, session.RoomID)
	encoded := make([]messageDTO, 0, len(messages))
	for _, message := range messages {
		encoded = append(encoded, encodeMessage(message, session.IdentityKey))
	}
	return snapshot{Typing: h.hub.typing(session), Messages: encoded, Peers: peers, Preferences: own.Preferences, Admin: own.Admin}, err
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

func (h Socket) writeEvent(ctx context.Context, conn *websocket.Conn, event messageDTO) error {
	if event.Kind == "signal" {
		return socketWrite(ctx, conn, map[string]string{"type": "signal", "sender": event.Author, "body": event.Body})
	}
	return socketWrite(ctx, conn, map[string]any{"type": "private", "message": event})
}
func (h Socket) media(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	if h.experience.Media == nil {
		return true
	}
	message, err := h.experience.Media(ctx, session, cmd.ClientID, cmd.Media)
	if err != nil {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "media_rejected"}) == nil
	}
	return socketWrite(ctx, conn, map[string]any{"type": "ack", "message": encodeMessage(message, session.IdentityKey)}) == nil
}
func (h Socket) preferences(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	if h.experience.Save == nil {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "preferences_unavailable"}) == nil
	}
	saved, err := h.experience.Save(ctx, session, cmd.Preferences)
	if err != nil {
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": "preferences_failed"}) == nil
	}
	return socketWrite(ctx, conn, map[string]any{"type": "preferences", "preferences": saved}) == nil

}

func (h Socket) heartbeat(ctx context.Context, conn *websocket.Conn, session domain.Session, visibility string) bool {
	ping, done := context.WithTimeout(ctx, 10*time.Second)
	defer done()
	if conn.Ping(ping) != nil {
		return false
	}
	return h.service.Touch(ctx, session.ID, session.IdentityKey, session.Generation, visibility, time.Now()) == nil
}

func (h Socket) sendCommand(ctx context.Context, conn *websocket.Conn, session domain.Session, cmd command) bool {
	h.hub.setTyping(session, false)
	if strings.HasPrefix(strings.TrimSpace(cmd.Body), "^") {
		return h.private(ctx, conn, session, cmd)
	}
	message, err := h.send(ctx, session, cmd.ClientID, cmd.Body)
	if err != nil {
		code := "message_rejected"
		if errors.Is(err, rooms.ErrRateLimited) {
			code = "rate_limited"
		}
		return socketWrite(ctx, conn, map[string]string{"type": "error", "code": code, "client_id": cmd.ClientID}) == nil
	}
	if h.experience.Bot != nil {
		h.experience.Bot(session, message, h.clientIP)
	}
	return socketWrite(ctx, conn, map[string]any{"type": "ack", "message": encodeMessage(message, session.IdentityKey)}) == nil
}

func (h Socket) messageLimited(session domain.Session, cmd command) bool {
	if cmd.Type != "send" && cmd.Type != "media" {
		return false
	}
	return !h.limiter.Message(session.IdentityKey, h.clientIP, cmd.ClientID, !strings.HasPrefix(session.IdentityKey, "user:"), time.Now())
}
