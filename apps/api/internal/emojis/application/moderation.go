package application

import (
	"chat/api/internal/emojis/domain"
	"context"
)

type ManagedEmoji = domain.ManagedEmoji
type Tag = domain.Tag
type Moderation = domain.Moderation
type Moderator func(context.Context, int64) (bool, error)
type ManagementStore interface {
	Managed(context.Context) ([]ManagedEmoji, []Tag, error)
	Moderate(context.Context, int64, Moderation) error
	Delete(context.Context, int64) error
	SaveTag(context.Context, Tag) (int64, error)
	DeleteTag(context.Context, int64) error
	ManagedImage(context.Context, int64) (domain.Image, error)
}
type Management struct {
	store        ManagementStore
	allowed      Moderator
	uploader     Uploader
	removeObject func(context.Context, string) error
}

func NewManagement(s ManagementStore, a Moderator, u Uploader) Management {
	return Management{store: s, allowed: a, uploader: u}
}
func (m Management) authorize(ctx context.Context, user int64) error {
	ok, err := m.allowed(ctx, user)
	if err != nil {
		return err
	}
	if !ok {
		return domain.ErrForbidden
	}
	return nil
}
func (m Management) List(ctx context.Context, user int64) ([]ManagedEmoji, []Tag, error) {
	if err := m.authorize(ctx, user); err != nil {
		return nil, nil, err
	}
	return m.store.Managed(ctx)
}
func (m Management) Moderate(ctx context.Context, user, id int64, v Moderation) error {
	if err := m.authorize(ctx, user); err != nil {
		return err
	}
	v, err := domain.NormalizeModeration(v)
	if err != nil {
		return err
	}
	return m.store.Moderate(ctx, id, v)
}
func (m Management) Delete(ctx context.Context, user, id int64) error {
	if err := m.authorize(ctx, user); err != nil {
		return err
	}
	image, err := m.store.ManagedImage(ctx, id)
	if err != nil {
		return err
	}
	if image.Key != "" {
		if m.removeObject == nil {
			return domain.ErrUnavailable
		}
		if err := m.removeObject(ctx, image.Key); err != nil {
			return err
		}
	}
	return m.store.Delete(ctx, id)
}
func (m Management) SaveTag(ctx context.Context, user int64, v Tag) (int64, error) {
	if err := m.authorize(ctx, user); err != nil {
		return 0, err
	}
	v, err := domain.NormalizeTag(v)
	if err != nil {
		return 0, err
	}
	return m.store.SaveTag(ctx, v)
}
func (m Management) DeleteTag(ctx context.Context, user, id int64) error {
	if err := m.authorize(ctx, user); err != nil {
		return err
	}
	return m.store.DeleteTag(ctx, id)
}
func (m Management) Upload(ctx context.Context, user int64, v Upload) error {
	if err := m.authorize(ctx, user); err != nil {
		return err
	}
	v.UserID = user
	v.Code = domain.NormalizeCode(v.Code)
	return m.uploader.Submit(ctx, v)
}
func (m Management) Image(ctx context.Context, user, id int64) (domain.Image, error) {
	if err := m.authorize(ctx, user); err != nil {
		return domain.Image{}, err
	}
	return m.store.ManagedImage(ctx, id)
}

func (m Management) WithObjectRemoval(remove func(context.Context, string) error) Management {
	m.removeObject = remove
	return m
}
