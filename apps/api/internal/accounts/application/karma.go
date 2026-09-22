package application

import (
	"context"
	"errors"
)

type KarmaStore interface {
	FindKarmaUser(context.Context, string) (int64, error)
	ChangeKarma(context.Context, int64, int) error
}
type Karma struct{ store KarmaStore }

func NewKarma(s KarmaStore) Karma { return Karma{s} }
func (s Karma) Find(ctx context.Context, nickname string) (int64, error) {
	return s.store.FindKarmaUser(ctx, nickname)
}
func (s Karma) Adjust(ctx context.Context, user int64, delta int) error {
	if user <= 0 || (delta != 1 && delta != -1) {
		return errors.New("invalid karma change")
	}
	return s.store.ChangeKarma(ctx, user, delta)
}
