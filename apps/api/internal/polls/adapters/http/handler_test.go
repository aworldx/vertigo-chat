package http

import (
	"chat/api/internal/polls/application"
	"chat/api/internal/polls/domain"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type memoryStore struct {
	votes  map[string]bool
	closed bool
}

func (s *memoryStore) Create(_ context.Context, _ int64, input domain.Input) (domain.Poll, error) {
	return domain.Poll{ID: 1, Question: input.Question, Status: "open"}, nil
}
func (s *memoryStore) List(context.Context, string) ([]domain.Poll, error) {
	return []domain.Poll{}, nil
}
func (s *memoryStore) Vote(_ context.Context, pollID int64, nickname string, optionID int64) error {
	if pollID != 1 || optionID != 2 {
		return domain.ErrInvalid
	}
	if s.closed {
		return domain.ErrClosed
	}
	if s.votes[nickname] {
		return domain.ErrVoted
	}
	s.votes[nickname] = true
	return nil
}
func (s *memoryStore) Close(_ context.Context, pollID int64) error {
	if pollID != 1 {
		return domain.ErrNotFound
	}
	s.closed = true
	return nil
}

func TestPollHTTPAuthorizationVoteAndClose(t *testing.T) {
	store := &memoryStore{votes: map[string]bool{}}
	identity := func(r *http.Request, mutation bool) (int64, int) {
		if mutation && r.Header.Get("X-CSRF-Token") != "csrf" {
			return 0, 403
		}
		if r.Header.Get("X-User") == "admin" {
			return 9, 0
		}
		return 8, 0
	}
	h := NewHandler(application.NewService(store), identity, identity, func(_ context.Context, token string) (string, error) {
		if token == "chat" || token == "chat2" {
			return token, nil
		}
		return "", domain.ErrForbidden
	}, func(_ context.Context, user int64) (bool, error) { return user == 9, nil })
	mux := http.NewServeMux()
	h.Register(mux)
	req := func(method, path, body, csrf, user, chat string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("X-CSRF-Token", csrf)
		r.Header.Set("X-User", user)
		r.Header.Set("X-Chat-Session", chat)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := req("GET", "/api/v1/polls", "", "", "", ""); w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("public list: %d %s", w.Code, w.Header().Get("Cache-Control"))
	}
	assertPollStatus(t, req("POST", "/api/v1/admin/polls", `{"question":"q","options":["a","b"]}`, "csrf", "", ""), 403, "")
	assertPollStatus(t, req("POST", "/api/v1/admin/polls", `{"question":"q","options":["a","b"]}`, "csrf", "admin", ""), 201, "")
	assertPollStatus(t, req("POST", "/api/v1/polls/1/votes", `{"option_id":2}`, "", "", "chat"), 403, "")
	assertPollStatus(t, req("POST", "/api/v1/polls/1/votes", `{"option_id":2}`, "csrf", "", "chat"), 201, "")
	assertPollStatus(t, req("POST", "/api/v1/polls/1/votes", `{"option_id":2}`, "csrf", "", "chat"), 409, "already_voted")
	assertPollStatus(t, req("POST", "/api/v1/admin/polls/1/close", `{}`, "csrf", "admin", ""), 200, "")
	assertPollStatus(t, req("POST", "/api/v1/polls/1/votes", `{"option_id":2}`, "csrf", "", "chat2"), 409, "poll_closed")
}

func assertPollStatus(t *testing.T, w *httptest.ResponseRecorder, want int, contains string) {
	t.Helper()
	if w.Code != want || (contains != "" && !strings.Contains(w.Body.String(), contains)) {
		t.Fatalf("response: %d %s", w.Code, w.Body.String())
	}
}
