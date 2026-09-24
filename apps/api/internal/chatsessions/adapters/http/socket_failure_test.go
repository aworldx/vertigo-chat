package http

import (
	chatlans "chat/api/internal/chatlans/application"
	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
	media "chat/api/internal/mediasearch/application"
	rooms "chat/api/internal/rooms/domain"
	"context"
	"encoding/base64"
	"errors"
	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func socketResponse(t *testing.T, action func(context.Context, *websocket.Conn)) map[string]any {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer func() { _ = conn.CloseNow() }()
		action(ctx, conn)
	}))
	defer server.Close()
	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.CloseNow() }()
	var frame map[string]any
	if err := wsjson.Read(ctx, conn, &frame); err != nil {
		t.Fatal(err)
	}
	return frame
}
func TestSocketMediaAndPreferenceFailuresRemainRecoverable(t *testing.T) {
	for _, failed := range []bool{false, true} {
		frame := socketResponse(t, func(ctx context.Context, conn *websocket.Conn) {
			h := Socket{experience: Experience{Media: func(_ context.Context, _ domain.Session, id string, item media.Item) (rooms.Message, error) {
				if failed {
					return rooms.Message{}, errors.New("offline")
				}
				return rooms.Message{ID: 7, ClientID: id, Body: item.Title, Kind: "music"}, nil
			}}}
			if !h.media(ctx, conn, domain.Session{}, command{ClientID: "id", Media: media.Item{Title: "Song"}}) {
				t.Error("write failed")
			}
		})
		want := "ack"
		if failed {
			want = "error"
		}
		if frame["type"] != want {
			t.Fatal(frame)
		}
	}
	for _, mode := range []string{"unavailable", "failed", "saved"} {
		frame := socketResponse(t, func(ctx context.Context, conn *websocket.Conn) {
			h := Socket{}
			if mode != "unavailable" {
				h.experience.Save = func(_ context.Context, _ domain.Session, p chatlans.Preferences) (chatlans.Preferences, error) {
					if mode == "failed" {
						return p, errors.New("offline")
					}
					return p, nil
				}
			}
			if !h.preferences(ctx, conn, domain.Session{}, command{Preferences: chatlans.Default()}) {
				t.Error("write failed")
			}
		})
		want := "error"
		if mode == "saved" {
			want = "preferences"
		}
		if frame["type"] != want {
			t.Fatal(frame)
		}
	}
	if !(Socket{}).media(context.Background(), nil, domain.Session{}, command{}) {
		t.Fatal("disabled media broke connection")
	}
}
func TestTerminalSocketErrorsUsePolicyCloseOnlyForEndedSessions(t *testing.T) {
	for _, tc := range []struct {
		err    error
		status websocket.StatusCode
	}{{domain.ErrInvalidSession, websocket.StatusPolicyViolation}, {errors.New("offline"), websocket.StatusInternalError}} {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			conn, err := websocket.Accept(w, r, nil)
			if err != nil {
				t.Error(err)
				return
			}
			closeSessionError(conn, tc.err)
		}))
		conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), nil)
		if err != nil {
			t.Fatal(err)
		}
		_, _, err = conn.Read(ctx)
		if websocket.CloseStatus(err) != tc.status {
			t.Error(err)
		}
		_ = conn.CloseNow()
		server.Close()
		cancel()
	}
}
func TestUnavailableRoomActionsRejectWithoutBreakingOtherCommands(t *testing.T) {
	h := Socket{}
	if h.roomAction(context.Background(), nil, domain.Session{}, command{Type: "reaction"}) || h.roomAction(context.Background(), nil, domain.Session{}, command{Type: "delete"}) {
		t.Fatal("unavailable action accepted")
	}
	frame := socketResponse(t, func(ctx context.Context, conn *websocket.Conn) {
		h.experience.Delete = func(context.Context, domain.Session, int64) error { return errors.New("forbidden") }
		if !h.roomAction(ctx, conn, domain.Session{}, command{Type: "delete", MessageID: 1}) {
			t.Error("error was not delivered")
		}
	})
	if frame["code"] != "action_rejected" {
		t.Fatal(frame)
	}
}

type projectionFunc func(context.Context, string) ([]domain.Session, error)

func (f projectionFunc) Presence(ctx context.Context, room string) ([]domain.Session, error) {
	return f(ctx, room)
}

type historyFunc func(context.Context, string) ([]rooms.Message, error)

func (f historyFunc) Recent(ctx context.Context, room string) ([]rooms.Message, error) {
	return f(ctx, room)
}
func TestSocketRejectsInvalidResumeAndUnavailableProjection(t *testing.T) {
	for _, mode := range []string{"invalid token", "ended session", "projection unavailable"} {
		t.Run(mode, func(t *testing.T) {
			var store application.Store = storeStub{}
			if mode == "ended session" {
				store = rejectedStore{}
			}
			h := NewSocket(application.NewService(store), projectionFunc(func(context.Context, string) ([]domain.Session, error) { return nil, errors.New("database offline") }), nil, nil, "")
			mux := http.NewServeMux()
			server := httptest.NewServer(mux)
			defer server.Close()
			h.origin = server.URL
			h.Register(mux)
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http")+"/api/v1/chat/socket", &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {server.URL}}})
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = conn.CloseNow() }()
			token := EncodeResume(Resume{SessionID: "00000000-0000-4000-8000-000000000000", IdentityKey: "guest:test", Secret: base64.RawURLEncoding.EncodeToString(make([]byte, 32))})
			if mode == "invalid token" {
				token = "invalid"
			}
			if err := wsjson.Write(ctx, conn, command{Type: "resume", ResumeToken: token}); err != nil {
				t.Fatal(err)
			}
			_, _, err = conn.Read(ctx)
			if err == nil {
				t.Fatal("invalid session received data")
			}
			if mode != "projection unavailable" && websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
				t.Fatal(err)
			}
		})
	}
}
func TestSocketRejectsStaleCommandsAndPresentationFailures(t *testing.T) {
	h := NewSocket(application.NewService(rejectedStore{}), nil, nil, nil, "https://chat.example")
	for _, kind := range []string{"heartbeat", "typing", "listening", "leave"} {
		if h.command(context.Background(), nil, domain.Session{}, command{Type: kind}, "visible") {
			t.Fatal("stale command accepted", kind)
		}
	}
	session := domain.Session{ID: "session", RoomID: "lobby", Generation: 1}
	h.projection = projectionFunc(func(context.Context, string) ([]domain.Session, error) { return []domain.Session{session}, nil })
	h.experience.Present = func(context.Context, domain.Session) (Presentation, error) {
		return Presentation{}, errors.New("preferences unavailable")
	}
	if _, err := h.snapshot(context.Background(), session); err == nil {
		t.Fatal("snapshot ignored preferences failure")
	}
	h.experience.Present = nil
	h.history = historyFunc(func(context.Context, string) ([]rooms.Message, error) { return nil, errors.New("history unavailable") })
	if _, err := h.snapshot(context.Background(), session); err == nil {
		t.Fatal("snapshot ignored history failure")
	}
	frame := socketResponse(t, func(ctx context.Context, conn *websocket.Conn) {
		if !h.command(ctx, conn, session, command{Type: "unknown"}, "visible") {
			t.Error("unknown command broke connection")
		}
	})
	if frame["code"] != "invalid_command" {
		t.Fatal(frame)
	}
}
func TestMalformedResumeEnvelopesAreRejected(t *testing.T) {
	for _, token := range []string{strings.Repeat("a", 2049), base64.RawURLEncoding.EncodeToString([]byte("not json")), EncodeResume(Resume{SessionID: "short", IdentityKey: "guest:test", Secret: "invalid"})} {
		if _, err := DecodeResume(token); err == nil {
			t.Fatal("invalid credential accepted")
		}
	}
}
