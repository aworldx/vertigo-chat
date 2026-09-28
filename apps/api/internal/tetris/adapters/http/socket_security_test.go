package http

import (
	"chat/api/internal/tetris/application"
	"chat/api/internal/tetris/domain"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// Exercise the actual WebSocket boundary: HTTP authorization alone does not
// protect a socket whose credential is delivered in its first frame.
func socketFixture(t *testing.T) (string, string) {
	t.Helper()
	service := application.NewService(testStore{}, testStore{})
	actor := domain.Actor{Key: "member", Room: "lobby", Nickname: "Игрок"}
	game, err := service.Create(context.Background(), actor, true)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	NewHandler(service, func(_ context.Context, token string) (domain.Actor, error) {
		if token != "member" {
			return domain.Actor{}, domain.ErrForbidden
		}
		return actor, nil
	}, server.URL).Register(mux)
	t.Cleanup(server.Close)
	return "ws" + strings.TrimPrefix(server.URL, "http") + "/api/v1/tetris/", game.ID
}

func dialGame(t *testing.T, ctx context.Context, url string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"http" + strings.TrimPrefix(strings.Split(url, "/api/")[0], "ws")}}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.CloseNow() })
	return conn
}

func TestSocketRejectsUntrustedOriginAndCredentials(t *testing.T) {
	base, id := socketFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, response, err := websocket.Dial(ctx, base+id+"/socket", &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"https://evil.example"}}})
	if err == nil || response == nil || response.StatusCode != http.StatusForbidden {
		t.Fatalf("origin was accepted: %v", err)
	}
	for _, tc := range []struct{ name, id, token string }{
		{"expired credential", id, "expired"},
		{"unknown room", "does-not-exist", "member"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conn := dialGame(t, ctx, base+tc.id+"/socket")
			if err := wsjson.Write(ctx, conn, command{Type: "auth", Token: tc.token}); err != nil {
				t.Fatal(err)
			}
			_, _, err := conn.Read(ctx)
			if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
				t.Fatalf("expected policy closure, got %v", err)
			}
		})
	}
}

func TestSocketRejectsCommandFloodWithReadableErrors(t *testing.T) {
	base, id := socketFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn := dialGame(t, ctx, base+id+"/socket")
	if err := wsjson.Write(ctx, conn, command{Type: "auth", Token: "member"}); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 41; i++ {
		if err := wsjson.Write(ctx, conn, command{Type: "unknown-action", Sequence: int64(i + 1)}); err != nil {
			t.Fatal(err)
		}
	}
	errors := 0
	for {
		var frame struct {
			Type    string `json:"type"`
			Message string `json:"message"`
		}
		err := wsjson.Read(ctx, conn, &frame)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
				t.Fatalf("flood was not rejected: %v", err)
			}
			break
		}
		if frame.Type == "error" {
			errors++
			if !strings.Contains(frame.Message, "Действие недоступно") {
				t.Fatalf("unsafe error: %q", frame.Message)
			}
		}
	}
	if errors == 0 {
		t.Fatal("invalid commands did not receive an error")
	}
}

func TestSecondGameSocketClosesOnlyThePreviousConnection(t *testing.T) {
	base, id := socketFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	first := dialGame(t, ctx, base+id+"/socket")
	if err := wsjson.Write(ctx, first, command{Type: "auth", Token: "member"}); err != nil {
		t.Fatal(err)
	}
	var state struct {
		Type string `json:"type"`
	}
	if err := wsjson.Read(ctx, first, &state); err != nil || state.Type != "state" {
		t.Fatalf("initial state: %v %+v", err, state)
	}
	second := dialGame(t, ctx, base+id+"/socket")
	if err := wsjson.Write(ctx, second, command{Type: "auth", Token: "member"}); err != nil {
		t.Fatal(err)
	}
	for {
		_, _, err := first.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) != websocket.StatusNormalClosure {
				t.Fatalf("old socket: %v", err)
			}
			break
		}
	}
	if err := wsjson.Read(ctx, second, &state); err != nil || state.Type != "state" {
		t.Fatalf("replacement connection lost: %v %+v", err, state)
	}
}

func TestGameReadAndRematchDoNotBypassAuthentication(t *testing.T) {
	service := application.NewService(testStore{}, testStore{})
	mux := http.NewServeMux()
	NewHandler(service, func(_ context.Context, token string) (domain.Actor, error) {
		if token != "member" {
			return domain.Actor{}, domain.ErrForbidden
		}
		return domain.Actor{Key: "member", Room: "lobby", Nickname: "Игрок"}, nil
	}, "http://localhost").Register(mux)
	for _, tc := range []struct {
		method, path, token string
		status              int
	}{
		{"GET", "/api/v1/tetris/unknown", "", http.StatusUnauthorized},
		{"GET", "/api/v1/tetris/unknown", "member", http.StatusNotFound},
		{"POST", "/api/v1/tetris/unknown/rematch", "", http.StatusUnauthorized},
		{"POST", "/api/v1/tetris/unknown/rematch", "member", http.StatusNotFound},
	} {
		t.Run(tc.method+tc.path+tc.token, func(t *testing.T) {
			request := httptest.NewRequest(tc.method, tc.path, nil)
			request.Header.Set("Origin", "http://localhost")
			request.Header.Set("Authorization", "Bearer "+tc.token)
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("got %d want %d: %s", response.Code, tc.status, response.Body.String())
			}
		})
	}
}
