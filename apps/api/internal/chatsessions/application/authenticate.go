package application

import (
	"chat/api/internal/chatsessions/domain"
	"context"
)

type CredentialReader interface {
	Authenticate(context.Context, string, string, string, int) (domain.Session, error)
}
type CommandAuthenticator struct{ reader CredentialReader }

func NewCommandAuthenticator(reader CredentialReader) CommandAuthenticator {
	return CommandAuthenticator{reader}
}
func (a CommandAuthenticator) Authenticate(ctx context.Context, id, identity, secret string, generation int) (domain.Session, error) {
	return a.reader.Authenticate(ctx, id, identity, secret, generation)
}
