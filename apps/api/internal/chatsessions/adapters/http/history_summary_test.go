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

type historySummaryStub struct {
	err   error
	calls int
}

func (s *historySummaryStub) Summarize(_ context.Context, actor int64, from, through string, filters domain.HistoryFilters, _ time.Time) (rooms.HistorySummaryResult, error) {
	s.calls++
	return rooms.HistorySummaryResult{Summary: "Сводка", Messages: 120}, s.err
}
func TestHistorySummaryHTTP(t *testing.T) {
	for _, tc := range []struct {
		name, body   string
		auth, status int
		err          error
		calls        int
	}{
		{"ok", `{"from":"2026-09-29","through":"2026-09-29"}`, 0, 200, nil, 1},
		{"login", `{}`, 401, 401, nil, 0}, {"csrf", `{}`, 403, 403, nil, 0},
		{"json", `no`, 0, 400, nil, 0}, {"unknown field", `{"messages":[]}`, 0, 400, nil, 0},
		{"trailing", `{} {}`, 0, 400, nil, 0}, {"oversized", strings.Repeat(" ", 2050) + `{}`, 0, 400, nil, 0},
		{"period", `{}`, 0, 400, rooms.ErrInvalidPeriod, 1}, {"empty", `{}`, 0, 422, rooms.ErrSummaryEmpty, 1},
		{"large", `{}`, 0, 422, rooms.ErrSummaryLarge, 1}, {"busy", `{}`, 0, 429, rooms.ErrSummaryBusy, 1},
		{"provider", `{}`, 0, 503, errors.New("provider"), 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			service := &historySummaryStub{err: tc.err}
			RegisterHistorySummary(mux, service, func(_ *http.Request, mutation bool) (int64, int) {
				if !mutation {
					t.Fatal("CSRF required")
				}
				return 1, tc.auth
			})
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/chat/history/summary", strings.NewReader(tc.body)))
			if w.Code != tc.status || service.calls != tc.calls || w.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("%d %s calls=%d", w.Code, w.Body.String(), service.calls)
			}
		})
	}
}
