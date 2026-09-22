package application

import (
	"chat/api/internal/musicchart/domain"
	"context"
)

type Store interface {
	List(context.Context, int64) ([]domain.Track, error)
	Audio(context.Context, int64) (domain.Audio, error)
	Add(context.Context, int64, string, domain.Audio) error
	Rename(context.Context, int64, int64, string) error
	Like(context.Context, int64, int64, bool) error
	Comment(context.Context, int64, int64, string) error
}
type AudioStorage interface {
	Save(context.Context, domain.Audio) (domain.Audio, error)
}
type Service struct {
	store Store
	audio AudioStorage
}

func NewService(s Store) Service { return Service{store: s} }
func (s Service) List(ctx context.Context, user int64) ([]domain.Track, error) {
	return s.store.List(ctx, user)
}
func (s Service) Audio(ctx context.Context, id int64) (domain.Audio, error) {
	if id <= 0 {
		return domain.Audio{}, domain.ErrNotFound
	}
	return s.store.Audio(ctx, id)
}
func (s Service) Add(ctx context.Context, user int64, title string, a domain.Audio) error {
	title, err := domain.Text(title, 120)
	if err != nil {
		return err
	}
	if user <= 0 || !domain.ValidAudio(a.Bytes, a.ContentType) {
		return domain.ErrInvalid
	}
	if s.audio != nil {
		a, err = s.audio.Save(ctx, a)
		if err != nil {
			return err
		}
	}
	return s.store.Add(ctx, user, title, a)
}
func (s Service) Rename(ctx context.Context, user, id int64, title string) error {
	title, err := domain.Text(title, 120)
	if err != nil {
		return err
	}
	if user <= 0 || id <= 0 {
		return domain.ErrForbidden
	}
	return s.store.Rename(ctx, user, id, title)
}
func (s Service) Like(ctx context.Context, user, id int64, active bool) error {
	if user <= 0 || id <= 0 {
		return domain.ErrForbidden
	}
	return s.store.Like(ctx, user, id, active)
}
func (s Service) Comment(ctx context.Context, user, id int64, body string) error {
	body, err := domain.Text(body, 280)
	if err != nil {
		return err
	}
	if user <= 0 || id <= 0 {
		return domain.ErrForbidden
	}
	return s.store.Comment(ctx, user, id, body)
}

func (s Service) WithAudioStorage(storage AudioStorage) Service { s.audio = storage; return s }
