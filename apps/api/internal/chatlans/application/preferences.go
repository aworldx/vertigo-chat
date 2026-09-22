// Package application coordinates guest and registered participant preferences.
package application

import (
	"chat/api/internal/chatlans/domain"
	"context"
)

// Preferences is the public application contract used by transport/composition.
type Preferences = domain.Preferences
type Store interface {
	Get(context.Context, string) (Preferences, error)
	Put(context.Context, string, Preferences) error
}
type Service struct{ store Store }

func NewService(store Store) Service { return Service{store} }
func (s Service) Get(ctx context.Context, identity string) (Preferences, error) {
	p, err := s.store.Get(ctx, identity)
	return domain.Normalize(p), err
}
func (s Service) Save(ctx context.Context, identity string, p Preferences) (Preferences, error) {
	p = domain.Normalize(p)
	return p, s.store.Put(ctx, identity, p)
}
func Default() Preferences { return domain.Normalize(Preferences{}) }
