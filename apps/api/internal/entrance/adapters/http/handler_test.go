package http

import (
	"chat/api/internal/accounts/application"
	entrance "chat/api/internal/entrance/application"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestEntranceErrorContracts(t *testing.T) {
	for _, tc := range []struct {
		err      error
		status   int
		code     string
		register bool
	}{
		{entrance.ErrInvalidNickname, 422, "invalid_nickname", false}, {entrance.ErrInvalidNickname, 422, "registration_nickname", true}, {entrance.ErrNicknameOnline, 409, "nickname_online", false},
		{application.ErrPasswordRequired, 401, "password_required", false}, {application.ErrAccountNotFound, 401, "not_found", false}, {application.ErrInvalidCredentials, 401, "invalid_password", false},
		{application.ErrRegistrationNickname, 422, "registration_nickname", true}, {application.ErrRegistrationPassword, 422, "registration_password", true}, {application.ErrRegistrationEmail, 422, "registration_email", true}, {application.ErrInvalidRegistration, 422, "invalid_registration", true}, {application.ErrRegistrationLimited, 429, "registration_limited", true}, {application.ErrInvalidSession, 401, "session_changed", false}, {errors.New("offline"), 503, "unavailable", false},
	} {
		t.Run(tc.code, func(t *testing.T) {
			service := entrance.NewService(func(context.Context, string, func(entrance.Accounts, entrance.Sessions) error) error { return tc.err })
			handler := NewHandler(service, func(http.ResponseWriter, *http.Request) (string, bool) { return "", true }, func(http.ResponseWriter, string, time.Time) { t.Fatal("cookie set on failure") }, func(entrance.Result) string { return "" })
			mux := http.NewServeMux()
			handler.Register(mux)
			path := "/api/v1/chat/enter"
			if tc.register {
				path = "/api/v1/chat/register"
			}
			r := httptest.NewRequest("POST", path, strings.NewReader(`{"nickname":"Guest"}`))
			r.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.status || !strings.Contains(w.Body.String(), `"error":"`+tc.code+`"`) {
				t.Fatal(w)
			}
		})
	}
}
func TestEntranceRejectsMalformedRequestsBeforeWork(t *testing.T) {
	for _, tc := range []struct {
		body, kind, peer string
		denied           bool
		status           int
	}{
		{`{}`, "text/plain", "127.0.0.1:1", false, 415}, {`{`, "application/json", "127.0.0.1:1", false, 422}, {`{} {}`, "application/json", "127.0.0.1:1", false, 422}, {`{"unknown":1}`, "application/json", "127.0.0.1:1", false, 422}, {`{}`, "application/json", "bad", false, 400}, {`{}`, "application/json", "127.0.0.1:1", true, 403},
	} {
		service := entrance.NewService(func(context.Context, string, func(entrance.Accounts, entrance.Sessions) error) error {
			t.Fatal("invalid request reached work")
			return nil
		})
		h := NewHandler(service, func(w http.ResponseWriter, _ *http.Request) (string, bool) {
			if tc.denied {
				w.WriteHeader(403)
			}
			return "", !tc.denied
		}, nil, nil)
		mux := http.NewServeMux()
		h.Register(mux)
		r := httptest.NewRequest("POST", "/api/v1/chat/enter", strings.NewReader(tc.body))
		r.Header.Set("Content-Type", tc.kind)
		r.RemoteAddr = tc.peer
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatal(w)
		}
	}
}
