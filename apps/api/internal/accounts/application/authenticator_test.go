package application

import (
	"context"
	"testing"

	"chat/api/internal/accounts/domain"
)

type readerStub struct {
	principal domain.Principal
	hash      string
	err       error
}

func (s readerStub) FindByNickname(context.Context, string) (domain.Principal, string, error) {
	return s.principal, s.hash, s.err
}
func (s readerStub) FindPrincipal(context.Context, int64) (domain.Principal, error) {
	return s.principal, s.err
}

type verifierStub bool

func (s verifierStub) Verify(string, string) bool { return bool(s) }

func TestAuthenticateRejectsInvalidCredentials(t *testing.T) {
	authenticator := NewAuthenticator(readerStub{principal: domain.Principal{UserID: 7}}, verifierStub(true))
	if _, err := authenticator.Authenticate(context.Background(), "", "secret"); err != ErrInvalidCredentials {
		t.Fatalf("error = %v", err)
	}
	if _, err := authenticator.Authenticate(context.Background(), "alice", "secret"); err != nil {
		t.Fatalf("error = %v", err)
	}
}
