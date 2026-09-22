package application

import (
	"chat/api/internal/feedback/domain"
	"context"
)

type Entry = domain.Entry
type Store interface {
	Save(context.Context, Entry) error
}
type Service struct{ store Store }

func NewService(s Store) Service { return Service{s} }
func (s Service) Send(ctx context.Context, e Entry) error {
	e, err := domain.Normalize(e)
	if err != nil {
		return err
	}
	return s.store.Save(ctx, e)
}
