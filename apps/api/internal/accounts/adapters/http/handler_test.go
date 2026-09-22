package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"chat/api/internal/accounts/application"
	"chat/api/internal/accounts/domain"
)

type readerStub struct{ principal domain.Principal }

func (s readerStub) FindByNickname(context.Context, string) (domain.Principal, string, error) {
	return s.principal, "hash", nil
}
func (s readerStub) FindPrincipal(context.Context, int64) (domain.Principal, error) {
	return s.principal, nil
}

type verifierStub bool

func (s verifierStub) Verify(string, string) bool  { return bool(s) }
func (s verifierStub) Hash(string) (string, error) { return "hash", nil }

type creatorStub struct{ principal domain.Principal }

func (s creatorStub) Create(context.Context, string, string, string) (domain.Principal, error) {
	return s.principal, nil
}

func TestAuthenticateRequiresTrustedCallerAndReturnsRoles(t *testing.T) {
	mux := http.NewServeMux()
	authenticator := application.NewAuthenticator(
		readerStub{principal: domain.Principal{UserID: 7, Nickname: "alice", Admin: true}}, verifierStub(true),
	)
	registrar := application.NewRegistrar(creatorStub{principal: domain.Principal{UserID: 8, Nickname: "new"}}, verifierStub(true))
	NewHandler(authenticator, registrar, "test-token").Register(mux)

	request := httptest.NewRequest(http.MethodPost, "/internal/v1/accounts/authenticate", strings.NewReader(`{"nickname":"alice","password":"secret"}`))
	request.Header.Set("X-Internal-Accounts-Token", "test-token")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"admin"`) {
		t.Fatalf("response = %d %s", response.Code, response.Body.String())
	}

	response = httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/internal/v1/accounts/authenticate", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("untrusted status = %d", response.Code)
	}
}
