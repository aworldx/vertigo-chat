package application

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"time"
)

// CredentialVerifier authorizes an auxiliary connection without restoring or
// fencing the user's main chat connection. It never extends a terminated session.
type CredentialVerifier interface {
	Verify(context.Context, string, string, string, time.Time) (domain.Session, error)
}
type Credentials struct{ store CredentialVerifier }

func NewCredentials(store CredentialVerifier) Credentials { return Credentials{store: store} }
func (c Credentials) Verify(ctx context.Context, id, key, secret string) (domain.Session, error) {
	return c.store.Verify(ctx, id, key, secret, time.Now())
}
