package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
)

type storeStub struct{}

func (storeStub) Start(_ context.Context, session domain.Session, _ string, _ *int64) (domain.Session, error) {
	session.VisitID = 1
	session.Status = domain.StatusActive
	return session, nil
}
func (storeStub) Restore(context.Context, string, string, string, time.Time, time.Time, time.Time) (domain.Session, error) {
	return domain.Session{ID: "session", RoomID: "lobby", Nickname: "guest", Generation: 2}, nil
}
func (storeStub) Reconnect(_ context.Context, _ string, _ string, generation int, now time.Time, grace time.Duration, _ time.Duration) (domain.Session, error) {
	deadline := now.Add(grace)
	return domain.Session{ID: "session", RoomID: "lobby", Nickname: "guest", Status: domain.StatusReconnecting, Generation: generation, ReconnectDeadline: &deadline}, nil
}
func (storeStub) Activate(_ context.Context, _ string, _ string, generation int, _ time.Time, _ time.Time, _ time.Time) (domain.Session, error) {
	return domain.Session{ID: "session", RoomID: "lobby", Nickname: "guest", Status: domain.StatusActive, Generation: generation + 1}, nil
}
func (storeStub) Touch(context.Context, string, string, int, string, time.Time, time.Time, time.Time) error {
	return nil
}
func (storeStub) MarkStale(context.Context, time.Time, time.Duration, time.Duration, time.Duration) ([]domain.Session, error) {
	return nil, nil
}
func (storeStub) Expired(context.Context, time.Time) ([]domain.Session, error) { return nil, nil }
func (storeStub) RegisterIdentity(context.Context, string, string, int, int64, string, time.Time) (domain.Session, error) {
	return domain.Session{Status: domain.StatusActive}, nil
}
func (storeStub) End(_ context.Context, _ string, _ string, generation int, _ time.Time) (domain.Session, error) {
	return domain.Session{ID: "session", RoomID: "lobby", Nickname: "guest", Status: domain.StatusEnded, Generation: generation + 1}, nil
}

func TestRestoreRequiresInternalTokenAndDoesNotExposeSecret(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewService(storeStub{}), "token").Register(mux)
	request := httptest.NewRequest(http.MethodPost, "/internal/v1/chat-sessions/restore", strings.NewReader(`{"session_id":"session","identity_key":"guest:1","resume_secret":"secret"}`))
	request.Header.Set("X-Internal-Chat-Sessions-Token", "token")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "secret") {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
	response = httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/internal/v1/chat-sessions/restore", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestLifecycleCommandsAreFencedAndNeverReturnSecrets(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewService(storeStub{}), "token").Register(mux)

	for _, path := range []string{"/internal/v1/chat-sessions/connection-lost", "/internal/v1/chat-sessions/activate", "/internal/v1/chat-sessions/leave"} {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"session_id":"session","identity_key":"guest:1","generation":2}`))
		request.Header.Set("X-Internal-Chat-Sessions-Token", "token")
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "secret") {
			t.Fatalf("%s response = %d %s", path, response.Code, response.Body.String())
		}
	}

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/internal/v1/chat-sessions/leave", strings.NewReader(`{"session_id":"session","generation":2}`)))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", response.Code)
	}
}

func TestStartRequiresInternalToken(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewService(storeStub{}), "token").Register(mux)
	request := httptest.NewRequest(http.MethodPost, "/internal/v1/chat-sessions/start", strings.NewReader(`{"room_id":"lobby","identity_key":"guest:1","nickname":"guest"}`))
	request.Header.Set("X-Internal-Chat-Sessions-Token", "token")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "resume_secret") {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
}

func TestRegisterIdentityRequiresACompleteFencedCommand(t *testing.T) {
	mux := http.NewServeMux()
	NewHandler(application.NewService(storeStub{}), "token").Register(mux)

	request := httptest.NewRequest(http.MethodPost, "/internal/v1/chat-sessions/register-identity", strings.NewReader(`{"session_id":"session","identity_key":"guest:1","generation":2,"user_id":3,"nickname":"member"}`))
	request.Header.Set("X-Internal-Chat-Sessions-Token", "token")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "resume_secret") {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}
}

type rejectedStore struct{ storeStub }

func (rejectedStore) Start(context.Context, domain.Session, string, *int64) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func (rejectedStore) Restore(context.Context, string, string, string, time.Time, time.Time, time.Time) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func (rejectedStore) Reconnect(context.Context, string, string, int, time.Time, time.Duration, time.Duration) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func (rejectedStore) Activate(context.Context, string, string, int, time.Time, time.Time, time.Time) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func (rejectedStore) Touch(context.Context, string, string, int, string, time.Time, time.Time, time.Time) error {
	return domain.ErrInvalidSession
}
func (rejectedStore) RegisterIdentity(context.Context, string, string, int, int64, string, time.Time) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func (rejectedStore) End(context.Context, string, string, int, time.Time) (domain.Session, error) {
	return domain.Session{}, domain.ErrInvalidSession
}
func TestLifecycleMalformedUnauthorizedAndRejectedCommands(t *testing.T) {
	for _, tc := range []struct {
		path, body string
		status     int
	}{
		{"start", `{"room_id":"lobby","identity_key":"guest:1","nickname":"Guest"}`, 409},
		{"restore", `{"session_id":"session","identity_key":"guest:1","resume_secret":"secret"}`, 401},
		{"connection-lost", `{"session_id":"session","identity_key":"guest:1","generation":1}`, 409},
		{"activate", `{"session_id":"session","identity_key":"guest:1","generation":1}`, 409},
		{"touch", `{"session_id":"session","identity_key":"guest:1","generation":1,"visibility":"hidden"}`, 409},
		{"leave", `{"session_id":"session","identity_key":"guest:1","generation":1}`, 409},
		{"register-identity", `{"session_id":"session","identity_key":"guest:1","generation":1,"user_id":1,"nickname":"Guest"}`, 409},
	} {
		t.Run(tc.path, func(t *testing.T) {
			mux := http.NewServeMux()
			NewHandler(application.NewService(rejectedStore{}), "token").Register(mux)
			for _, requestCase := range []struct {
				body, token string
				status      int
			}{{tc.body, "token", tc.status}, {`{`, "token", 422}, {tc.body, "wrong", 401}} {
				r := httptest.NewRequest("POST", "/internal/v1/chat-sessions/"+tc.path, strings.NewReader(requestCase.body))
				r.Header.Set("X-Internal-Chat-Sessions-Token", requestCase.token)
				w := httptest.NewRecorder()
				mux.ServeHTTP(w, r)
				if w.Code != requestCase.status {
					t.Fatal(w.Code, requestCase)
				}
			}
		})
	}
	mux := http.NewServeMux()
	NewHandler(application.NewService(storeStub{}), "token").Register(mux)
	r := httptest.NewRequest("POST", "/internal/v1/chat-sessions/touch", strings.NewReader(`{"session_id":"session","identity_key":"guest:1","generation":1,"visibility":"hidden"}`))
	r.Header.Set("X-Internal-Chat-Sessions-Token", "token")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
}
