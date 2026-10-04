package http

import (
	"chat/api/internal/tetris/application"
	"chat/api/internal/tetris/domain"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type testStore struct{}

func (testStore) Save(context.Context, application.Result) error { return nil }
func (testStore) Leaders(context.Context, string, string) ([]application.Leader, error) {
	return []application.Leader{}, nil
}
func (testStore) Publish(context.Context, application.Invitation) error { return nil }
func TestHTTPAuthorizationAndPrivateSolo(t *testing.T) {
	s := application.NewService(testStore{}, testStore{})
	h := NewHandler(s, func(_ context.Context, token string) (domain.Actor, error) {
		if token == "" {
			return domain.Actor{}, domain.ErrForbidden
		}
		return domain.Actor{Key: token, Room: "lobby", Nickname: token}, nil
	}, "http://localhost")
	mux := http.NewServeMux()
	h.Register(mux)
	request := func(method, path, body, token, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Authorization", "Bearer "+token)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := request("POST", "/api/v1/tetris", `{"mode":"solo"}`, "a", "http://evil"); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := request("POST", "/api/v1/tetris", `{"mode":"solo"}`, "", "http://localhost"); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := request("POST", "/api/v1/tetris", `{"mode":"oops"}`, "a", "http://localhost"); w.Code != 422 {
		t.Fatal(w.Code)
	}
	w := request("POST", "/api/v1/tetris", `{"mode":"solo"}`, "a", "http://localhost")
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var game gameDTO
	if err := json.Unmarshal(w.Body.Bytes(), &game); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(w.Body.String(), "guest:") || strings.Contains(w.Body.String(), "user:") {
		t.Fatal("identity leaked")
	}
	if game.Mode != "solo" || game.Status != "countdown" || len(game.Players) != 1 {
		t.Fatalf("%+v", game)
	}
	if w := request("GET", "/api/v1/tetris/"+game.ID, "", "b", ""); w.Code != 403 {
		t.Fatal("solo visible to another player")
	}
	if w := request("GET", "/api/v1/tetris/leaderboard", "", "", ""); w.Code != 200 || w.Body.String() != "[]\n" {
		t.Fatal("public empty rankings", w.Body.String())
	}
}

func TestSimulationCheckpointIsOwnerOnly(t *testing.T) {
	a := domain.Actor{Key: "a", Room: "r"}
	b := domain.Actor{Key: "b", Room: "r"}
	m := domain.NewMatch("game", "code", a, false, 42, time.Now())
	if err := m.Join(b, time.Now()); err != nil {
		t.Fatal(err)
	}
	own := encode(m, a)
	if own.Players[0].Simulation == nil || own.Players[1].Simulation != nil {
		t.Fatal("checkpoint missing or exposed to opponent")
	}
	observer := encode(m, domain.Actor{Key: "observer", Room: "r"})
	for _, p := range observer.Players {
		if p.Simulation != nil {
			t.Fatal("checkpoint exposed to observer")
		}
	}
}
