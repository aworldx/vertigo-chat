package postgres

import (
	"context"
	"errors"

	"chat/api/internal/profiles/domain"
)

type storedMedia struct {
	bytes       []byte
	key         *string
	contentType string
}

type mediaStore interface {
	store(context.Context, domain.PhotoInput, []byte) (storedMedia, storedMedia, error)
	load(context.Context, string) ([]byte, error)
}

type databaseMedia struct{}

func (databaseMedia) store(_ context.Context, input domain.PhotoInput, thumbnail []byte) (storedMedia, storedMedia, error) {
	return storedMedia{bytes: input.Bytes, contentType: input.ContentType}, storedMedia{bytes: thumbnail, contentType: "image/webp"}, nil
}

func (databaseMedia) load(_ context.Context, _ string) ([]byte, error) {
	return nil, errStorageUnavailable
}

var errStorageUnavailable = errors.New("profile media storage unavailable")
