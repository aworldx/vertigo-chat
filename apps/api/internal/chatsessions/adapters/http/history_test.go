package http

import (
	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type historyStub struct {
	since time.Time
	fail  bool
}

func (s *historyStub) RecentVisits(_ context.Context, since time.Time) ([]domain.Visit, error) {
	s.since = since
	if s.fail {
		return nil, errors.New("private storage detail")
	}
	return []domain.Visit{{ID: 1, Nickname: "<guest>", EnteredAt: time.Date(2026, 9, 22, 10, 15, 0, 0, time.FixedZone("offset", 3*3600))}}, nil
}
func TestPublicHistoryContractAndCutoff(t *testing.T) {
	store := &historyStub{}
	mux := http.NewServeMux()
	NewHistoryHandler(application.NewHistory(store)).Register(mux)
	before := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Second)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/visits?since=1900", nil))
	if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("X-Robots-Tag") != "noindex, nofollow" {
		t.Fatal(w.Code, w.Header())
	}
	expected := "{\"data\":[{\"id\":1,\"nickname\":\"\\u003cguest\\u003e\",\"entered_at\":\"2026-09-22T07:15:00Z\",\"left_at\":null}],\"meta\":{\"history_hours\":48}}\n"
	if w.Body.String() != expected {
		t.Fatal(w.Body.String())
	}
	if store.since.Before(before) || store.since.After(time.Now().UTC().Add(-48*time.Hour)) {
		t.Fatal("wrong history cutoff", store.since)
	}
	store.fail = true
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/visits", nil))
	if w.Code != 503 || strings.Contains(w.Body.String(), "private") {
		t.Fatal(w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/visits", nil))
	if w.Code != 405 {
		t.Fatal("history must be read-only")
	}
}
