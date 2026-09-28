package http

import (
	rooms "chat/api/internal/rooms/application"
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type archiveStub struct{ fail bool }

func (s archiveStub) History(context.Context, string, time.Time, time.Time, int64, int, domain.HistoryFilters) ([]domain.Message, error) {
	if s.fail {
		return nil, errors.New("database")
	}
	messages := make([]domain.Message, 101)
	for i := range messages {
		messages[i] = domain.Message{ID: int64(i + 1), Kind: "text", ClientID: "internal-receipt", Body: "public"}
	}
	return messages, nil
}
func (s archiveStub) Prune(context.Context, time.Time) error { return nil }
func TestMessageArchiveHTTP(t *testing.T) {
	for _, tc := range []struct {
		query  string
		status int
		fail   bool
	}{
		{"", 400, false}, {"?from=2026-99-01&through=2026-01-01", 400, false}, {"?after=no", 400, false},
		{"?from=2000-01-01&through=2099-01-01", 200, false}, {"?from=2000-01-01&through=2099-01-01", 503, true},
	} {
		mux := http.NewServeMux()
		NewMessageHistoryHandler(rooms.NewHistory(archiveStub{tc.fail})).Register(mux)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/chat/history"+tc.query, nil))
		if w.Code != tc.status || w.Header().Get("Cache-Control") != "no-store" {
			t.Fatal(w.Code, w.Body.String())
		}
		if tc.status == 200 && (!strings.Contains(w.Body.String(), `"next":100`) || strings.Contains(w.Body.String(), "internal-receipt") || strings.Contains(w.Body.String(), `"id":101`)) {
			t.Fatal(w.Body.String())
		}
	}
}
