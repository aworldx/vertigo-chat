package application

import (
	"chat/api/internal/accounts/domain"
	"context"
	"errors"
)

var ErrEmailTaken = errors.New("email taken")

type EmailStore interface {
	ReadEmail(context.Context, int64) (*string, error)
	UpdateEmail(context.Context, int64, string) error
}
type Settings struct{ store EmailStore }

func NewSettings(store EmailStore) Settings { return Settings{store} }
func (s Settings) Read(ctx context.Context, actorID int64) (*string, error) {
	if actorID < 1 {
		return nil, ErrInvalidCredentials
	}
	return s.store.ReadEmail(ctx, actorID)
}
func (s Settings) Save(ctx context.Context, actorID int64, raw string) (string, error) {
	if actorID < 1 {
		return "", ErrInvalidCredentials
	}
	email, err := domain.ForumEmail(raw)
	if err != nil {
		return "", err
	}
	if err = s.store.UpdateEmail(ctx, actorID, email); err != nil {
		return "", err
	}
	return email, nil
}
