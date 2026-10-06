package http

import (
	"chat/api/internal/geogame/application"
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type memory struct{ g domain.Game }

func (s *memory) Update(_ context.Context, _ string, fn func(*domain.Game) error) error {
	return fn(&s.g)
}

type questions struct{}

func (questions) Configured() bool { return true }
func (questions) Prepare(context.Context) ([]domain.Question, error) {
	qs := make([]domain.Question, 5)
	for i := range qs {
		qs[i] = domain.Question{ID: fmt.Sprint(i), PanoID: "pano" + fmt.Sprint(i), Place: domain.Place{Country: "secret-country", Countries: []string{"secret-country"}}, Position: domain.Point{Lat: 12.345678, Lng: 76.54321}}
	}
	return qs, nil
}
func TestPrivateSnapshotsAndOrigin(t *testing.T) {
	now := time.Now()
	store := &memory{}
	service := application.Service{Store: store, Questions: questions{}, Now: func() time.Time { return now }}
	h := Handler{Service: service, Origin: "https://chat.test", BrowserKey: "public-browser-key", Authenticate: func(_ context.Context, token string) (domain.Actor, error) {
		if token == "" {
			return domain.Actor{}, domain.ErrInvalid
		}
		return domain.Actor{Key: token, Room: "room", Nickname: token}, nil
	}}
	mux := http.NewServeMux()
	h.Register(mux)
	request := func(method, path, token, origin, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("X-Chat-Session", token)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := request("GET", "/api/v1/geo", "", "", ""); w.Code != 401 {
		t.Fatal("anonymous allowed")
	}
	if w := request("POST", "/api/v1/geo/start", "a", "https://evil.test", ""); w.Code != 403 {
		t.Fatal("cross origin allowed")
	}
	start := request("POST", "/api/v1/geo/start", "a", h.Origin, "")
	if start.Code != 200 {
		t.Fatal(start.Body.String())
	}
	var state Snapshot
	if err := json.Unmarshal(start.Body.Bytes(), &state); err != nil {
		t.Fatal(err)
	}
	if w := request("PUT", "/api/v1/geo/answer", "a", h.Origin, fmt.Sprintf(`{"id":%q,"round":1,"text":"secret-country"}`, state.ID)); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	w := request("GET", "/api/v1/geo", "b", "", "")
	for _, secret := range []string{"secret-country", "12.345678", "76.54321", "countries", "position", "\"points\":1"} {
		if strings.Contains(w.Body.String(), secret) {
			t.Fatalf("leaked %s", secret)
		}
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("cacheable private data")
	}
	now = now.Add(5 * time.Minute)
	w = request("GET", "/api/v1/geo", "b", "", "")
	if !strings.Contains(w.Body.String(), "secret-country") {
		t.Fatal("missing result after deadline")
	}
}

type rankings struct{}

func (rankings) Leaders(context.Context) ([]domain.Ranking, error) {
	return []domain.Ranking{{Nickname: "Alice", Points: 12, Rounds: 5}}, nil
}
func TestPublicRanking(t *testing.T) {
	mux := http.NewServeMux()
	Handler{Rankings: rankings{}}.Register(mux)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest("GET", "/api/v1/geo/leaderboard", nil))
	if response.Code != 200 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal(response.Code)
	}
	var rows []domain.Ranking
	if err := json.Unmarshal(response.Body.Bytes(), &rows); err != nil || len(rows) != 1 || rows[0].Points != 12 {
		t.Fatal("invalid ranking response")
	}
	if strings.Contains(response.Body.String(), "user:") {
		t.Fatal("private identity leaked")
	}
}
