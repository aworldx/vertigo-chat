package application

import (
	"chat/api/internal/gallery/domain"
	"context"
)

type Photo = domain.Photo
type Media = domain.Media
type Upload = domain.Upload
type Viewer struct {
	Nickname  string
	CanUpload bool
}
type People interface {
	Viewer(context.Context, int64) (Viewer, error)
	Names(context.Context, []int64) (map[int64]string, error)
}
type Store interface {
	List(context.Context, int64) ([]Photo, error)
	Add(context.Context, int64, Upload) (int64, error)
	Caption(context.Context, int64, int64, string) error
	Like(context.Context, int64, int64, bool) error
	Media(context.Context, int64, bool) (Media, error)
}
type Service struct {
	store  Store
	people People
}

func NewService(s Store, p People) Service { return Service{s, p} }
func (s Service) List(ctx context.Context, user int64) ([]Photo, map[int64]string, Viewer, error) {
	viewer := Viewer{}
	if user > 0 {
		var err error
		viewer, err = s.people.Viewer(ctx, user)
		if err != nil {
			return nil, nil, viewer, err
		}
	}
	photos, err := s.store.List(ctx, user)
	if err != nil {
		return nil, nil, viewer, err
	}
	ids := make([]int64, 0, len(photos))
	for _, p := range photos {
		ids = append(ids, p.UserID)
	}
	names, err := s.people.Names(ctx, ids)
	return photos, names, viewer, err
}
func (s Service) Add(ctx context.Context, user int64, u Upload) (int64, error) {
	if user <= 0 {
		return 0, domain.ErrForbidden
	}
	u, err := domain.Normalize(u)
	if err != nil {
		return 0, err
	}
	return s.store.Add(ctx, user, u)
}
func (s Service) Caption(ctx context.Context, user, id int64, value string) error {
	if user <= 0 {
		return domain.ErrForbidden
	}
	value, err := domain.Caption(value)
	if err != nil {
		return err
	}
	return s.store.Caption(ctx, user, id, value)
}
func (s Service) Like(ctx context.Context, user, id int64, active bool) error {
	if user <= 0 {
		return domain.ErrForbidden
	}
	return s.store.Like(ctx, user, id, active)
}
func (s Service) Media(ctx context.Context, id int64, thumbnail bool) (Media, error) {
	return s.store.Media(ctx, id, thumbnail)
}
