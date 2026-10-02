package application

import (
	"chat/api/internal/notes/domain"
	"context"
)

type Store interface {
	Summary(context.Context, int64) (int, error)
	List(context.Context, int64) ([]domain.Note, []domain.Note, error)
	Send(context.Context, int64, domain.Input) (int64, error)
}

type Service struct{ store Store }

func NewService(store Store) Service { return Service{store: store} }
func (s Service) Summary(ctx context.Context, user int64) (int, error) {
	return s.store.Summary(ctx, user)
}
func (s Service) List(ctx context.Context, user int64) ([]domain.Note, []domain.Note, error) {
	return s.store.List(ctx, user)
}
func (s Service) Send(ctx context.Context, user int64, v domain.Input) (int64, error) {
	v, err := domain.Normalize(v)
	if err != nil {
		return 0, err
	}
	return s.store.Send(ctx, user, v)
}
