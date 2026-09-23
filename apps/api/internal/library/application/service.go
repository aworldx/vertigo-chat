package application

import (
	"chat/api/internal/library/domain"
	"context"
)

type Input = domain.Input
type Article = domain.Article
type Series = domain.Series
type People interface {
	CanPublish(context.Context, int64) (bool, error)
	Names(context.Context, []int64) (map[int64]string, error)
}
type Store interface {
	List(context.Context, int64, string) ([]Article, []Series, error)
	Save(context.Context, int64, int64, Input) (int64, error)
}
type Service struct {
	store  Store
	people People
}

func NewService(s Store, p People) Service { return Service{s, p} }
func (s Service) List(ctx context.Context, user, author int64, series string) ([]Article, []Series, map[int64]string, bool, error) {
	articles, groups, err := s.store.List(ctx, author, series)
	if err != nil {
		return nil, nil, nil, false, err
	}
	ids := []int64{}
	for _, a := range articles {
		ids = append(ids, a.UserID)
	}
	for _, g := range groups {
		ids = append(ids, g.UserID)
	}
	names, err := s.people.Names(ctx, ids)
	if err != nil {
		return nil, nil, nil, false, err
	}
	allowed := false
	if user > 0 {
		allowed, err = s.people.CanPublish(ctx, user)
	}
	return articles, groups, names, allowed, err
}
func (s Service) Save(ctx context.Context, user, id int64, v Input) (int64, error) {
	if user <= 0 {
		return 0, domain.ErrForbidden
	}
	v, err := domain.Normalize(v)
	if err != nil {
		return 0, err
	}
	return s.store.Save(ctx, user, id, v)
}
