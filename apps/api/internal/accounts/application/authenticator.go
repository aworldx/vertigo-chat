// Package application coordinates authentication without knowing storage details.
package application

import (
	"context"
	"errors"

	"chat/api/internal/accounts/domain"
)

var ErrInvalidCredentials = errors.New("invalid credentials")

type CredentialsReader interface {
	FindByNickname(context.Context, string) (domain.Principal, string, error)
	FindPrincipal(context.Context, int64) (domain.Principal, error)
}

type PasswordVerifier interface {
	Verify(password, encodedHash string) bool
}

type Authenticator struct {
	reader   CredentialsReader
	verifier PasswordVerifier
}

func NewAuthenticator(reader CredentialsReader, verifier PasswordVerifier) Authenticator {
	return Authenticator{reader: reader, verifier: verifier}
}

func (a Authenticator) Authenticate(ctx context.Context, nickname, password string) (domain.Principal, error) {
	if nickname == "" || password == "" {
		return domain.Principal{}, ErrInvalidCredentials
	}
	principal, hash, err := a.reader.FindByNickname(ctx, nickname)
	if err != nil || !a.verifier.Verify(password, hash) {
		return domain.Principal{}, ErrInvalidCredentials
	}
	return principal, nil
}

func (a Authenticator) Principal(ctx context.Context, userID int64) (domain.Principal, error) {
	if userID < 1 {
		return domain.Principal{}, ErrInvalidCredentials
	}
	principal, err := a.reader.FindPrincipal(ctx, userID)
	if err != nil {
		return domain.Principal{}, ErrInvalidCredentials
	}
	return principal, nil
}
