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
