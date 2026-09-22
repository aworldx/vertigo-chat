package application

import (
	"chat/api/internal/emojis/domain"
	"context"
)

type Store interface {
	List(context.Context) ([]domain.Emoji, error)
	Image(context.Context, int64) (domain.Image, error)
}
type Service struct{ store Store }

func NewService(store Store) Service                               { return Service{store} }
func (s Service) List(ctx context.Context) ([]domain.Emoji, error) { return s.store.List(ctx) }
func (s Service) Image(ctx context.Context, id int64) (domain.Image, error) {
	return s.store.Image(ctx, id)
}
