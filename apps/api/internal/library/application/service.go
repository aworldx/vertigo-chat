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
	List(context.Context, int64, int64, string, bool) ([]Article, []Series, error)
	Save(context.Context, int64, int64, Input) (int64, error)
	UpdateSeries(context.Context, int64, domain.SeriesInput) error
	Reaction(context.Context, int64, int64, string, bool) error
	AddImage(context.Context, int64, domain.Image) (int64, error)
	Image(context.Context, int64) (domain.Image, error)
}
type Service struct {
	store  Store
	people People
}

func NewService(s Store, p People) Service { return Service{s, p} }
func (s Service) List(ctx context.Context, user, author int64, series string, bookmarks bool) ([]Article, []Series, map[int64]string, bool, error) {
	articles, groups, err := s.store.List(ctx, user, author, series, bookmarks)
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

func (s Service) UpdateSeries(ctx context.Context, user int64, v domain.SeriesInput) error {
	if user <= 0 {
		return domain.ErrForbidden
	}
	v, err := domain.NormalizeSeries(v)
	if err != nil {
		return err
	}
	return s.store.UpdateSeries(ctx, user, v)
}
func (s Service) Reaction(ctx context.Context, user, id int64, kind string, active bool) error {
	if user <= 0 {
		return domain.ErrForbidden
	}
	if kind != "like" && kind != "bookmark" {
		return domain.ErrInvalid
	}
	return s.store.Reaction(ctx, user, id, kind, active)
}
func (s Service) AddImage(ctx context.Context, user int64, v domain.Image) (int64, error) {
	if user <= 0 {
		return 0, domain.ErrForbidden
	}
	v, err := domain.NormalizeImage(v)
	if err != nil {
		return 0, err
	}
	return s.store.AddImage(ctx, user, v)
}
func (s Service) Image(ctx context.Context, id int64) (domain.Image, error) {
	return s.store.Image(ctx, id)
}
