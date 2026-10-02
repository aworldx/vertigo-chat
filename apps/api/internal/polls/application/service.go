package application

import (
	"chat/api/internal/polls/domain"
	"context"
)

type Store interface {
	Create(context.Context, int64, domain.Input) (domain.Poll, error)
	List(context.Context, string) ([]domain.Poll, error)
	Vote(context.Context, int64, string, int64) error
	Close(context.Context, int64) error
}
type Service struct{ store Store }

func NewService(store Store) Service { return Service{store} }
func (s Service) Create(ctx context.Context, actor int64, input domain.Input) (domain.Poll, error) {
	v, err := domain.Normalize(input)
	if err != nil {
		return domain.Poll{}, err
	}
	return s.store.Create(ctx, actor, v)
}
func (s Service) List(ctx context.Context, nickname string) ([]domain.Poll, error) {
	return s.store.List(ctx, nickname)
}
func (s Service) Vote(ctx context.Context, pollID int64, nickname string, optionID int64) error {
	if pollID <= 0 || optionID <= 0 || nickname == "" {
		return domain.ErrInvalid
	}
	return s.store.Vote(ctx, pollID, nickname, optionID)
}
func (s Service) Close(ctx context.Context, pollID int64) error {
	if pollID <= 0 {
		return domain.ErrInvalid
	}
	return s.store.Close(ctx, pollID)
}
