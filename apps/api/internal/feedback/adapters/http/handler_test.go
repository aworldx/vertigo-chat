package http

import (
	"chat/api/internal/feedback/application"
	"chat/api/internal/feedback/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type feedbackStore struct {
	entries []application.Entry
	err     error
}

func (s *feedbackStore) Save(_ context.Context, e application.Entry) error {
	s.entries = append(s.entries, e)
	return s.err
}
func TestFeedbackBoundary(t *testing.T) {
	for _, tc := range []struct {
		name, body, peer string
		user             int64
		denied           bool
		fail             error
		status           int
	}{
		{name: "guest", body: `{"name":"  Гость  ","body":"  Спасибо  "}`, peer: "192.0.2.1:123", status: 201},
		{name: "account name cannot be forged", body: `{"name":"Чужой","body":"Спасибо"}`, peer: "192.0.2.1:123", user: 7, status: 201},
		{name: "unauthorized", denied: true, status: 401},
		{name: "bad JSON", body: `{`, status: 422},
		{name: "extra JSON", body: `{} {}`, status: 422},
		{name: "unknown field", body: `{"unexpected":1}`, status: 422},
		{name: "body too large", body: strings.Repeat(" ", 10001) + `{}`, status: 422},
		{name: "bad peer", body: `{}`, peer: "bad", status: 400},
		{name: "invalid name", body: `{"name":"x","body":"ok"}`, peer: "192.0.2.1:123", status: 422},
		{name: "store failure", body: `{"name":"Гость","body":"Спасибо"}`, peer: "192.0.2.1:123", fail: errors.New("offline"), status: 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &feedbackStore{err: tc.fail}
			mux := http.NewServeMux()
			NewHandler(application.NewService(store), func(w http.ResponseWriter, _ *http.Request) (int64, string, bool) {
				if tc.denied {
					w.WriteHeader(401)
				}
				return tc.user, "Владелец", !tc.denied
			}).Register(mux)
			request := httptest.NewRequest("POST", "/api/v1/chat/feedback", strings.NewReader(tc.body))
			request.RemoteAddr = tc.peer
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("%d %s", response.Code, response.Body)
			}
			if tc.status == 201 {
				if len(store.entries) != 1 || store.entries[0].Body != "Спасибо" {
					t.Fatal(store.entries)
				}
				wantName, wantIdentity := "Гость", "guest:192.0.2.1"
				if tc.user > 0 {
					wantName, wantIdentity = "Владелец", "user:7"
				}
				if e := store.entries[0]; e.Name != wantName || e.Identity != wantIdentity || e.UserID != tc.user {
					t.Fatal(e)
				}
				if !strings.Contains(response.Body.String(), `"sent":true`) || response.Header().Get("Cache-Control") != "no-store" {
					t.Fatal(response)
				}
			}
		})
	}
}
func TestFeedbackValidationBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		valid      bool
	}{
		{"яя", "яяя", true}, {strings.Repeat("я", 40), strings.Repeat("я", 2000), true},
		{"я", "яяя", false}, {strings.Repeat("я", 41), "яяя", false}, {"яя", "яя", false}, {"яя", strings.Repeat("я", 2001), false},
	} {
		store := &feedbackStore{}
		err := application.NewService(store).Send(context.Background(), application.Entry{Name: tc.name, Body: tc.body})
		if tc.valid {
			if err != nil || len(store.entries) != 1 {
				t.Fatal(err)
			}
		} else if !errors.Is(err, domain.ErrInvalid) || len(store.entries) != 0 {
			t.Fatal("invalid feedback persisted", err)
		}
	}
}
