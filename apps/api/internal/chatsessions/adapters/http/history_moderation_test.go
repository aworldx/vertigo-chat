package http

import (
	rooms "chat/api/internal/rooms/application"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type archiveActions struct {
	err   error
	calls int
}

func (s *archiveActions) Reaction(context.Context, string, int64, string, string, string, bool) error {
	return nil
}
func (s *archiveActions) Delete(context.Context, string, int64) error { s.calls++; return s.err }
func TestArchiveModerationAuthority(t *testing.T) {
	for _, tc := range []struct {
		name, path         string
		identityStatus     int
		allowed            bool
		roleErr, deleteErr error
		want               int
	}{
		{name: "anonymous", path: "1", identityStatus: 401, want: 401},
		{name: "csrf", path: "1", identityStatus: 403, want: 403},
		{name: "ordinary member", path: "1", want: 403},
		{name: "invalid id", path: "bad", allowed: true, want: 400},
		{name: "system or missing", path: "1", allowed: true, deleteErr: rooms.ErrActionDenied, want: 403},
		{name: "role unavailable", path: "1", roleErr: errors.New("database"), want: 503},
		{name: "storage unavailable", path: "1", allowed: true, deleteErr: errors.New("database"), want: 503},
		{name: "administrator", path: "1", allowed: true, want: 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &archiveActions{err: tc.deleteErr}
			notified := false
			service := rooms.NewModeration(rooms.NewActions(store), func(context.Context, int64) (bool, error) { return tc.allowed, tc.roleErr })
			mux := http.NewServeMux()
			RegisterHistoryModeration(mux, service, func(_ *http.Request, mutation bool) (int64, int) {
				if !mutation {
					t.Fatal("CSRF not requested")
				}
				return 4, tc.identityStatus
			}, func(room string, id int64) {
				if room != "lobby" || id != 1 {
					t.Fatal(room, id)
				}
				notified = true
			})
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("DELETE", "/api/v1/chat/history/"+tc.path, nil))
			if w.Code != tc.want || notified != (tc.want == 200) {
				t.Fatal(w.Code, w.Body.String(), notified)
			}
			if !tc.allowed && store.calls != 0 {
				t.Fatal("unauthorized persistence")
			}
		})
	}
}
func TestArchiveModerationNotifiesSocket(t *testing.T) {
	socket := Socket{hub: newHub(), cache: &snapshotCache{}}
	socket.MessageDeleted("lobby", 42)
	if ids := socket.hub.deletions("lobby"); len(ids) != 1 || ids[0] != 42 {
		t.Fatal(ids)
	}
}
