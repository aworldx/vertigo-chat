package application

import (
	"context"
	"errors"

	"chat/api/internal/profiles/domain"
)

var ErrInvalidPhoto = errors.New("invalid profile photo")

type PhotoUpdater interface {
	UpdatePhotoByUserID(context.Context, int64, domain.PhotoInput) (domain.Profile, error)
}

type PhotoEditor struct {
	repository PhotoUpdater
}

func NewPhotoEditor(repository PhotoUpdater) PhotoEditor { return PhotoEditor{repository: repository} }

func (e PhotoEditor) Update(ctx context.Context, actorID int64, input domain.PhotoInput) (domain.Profile, error) {
	if actorID < 1 || len(input.Bytes) == 0 || len(input.Bytes) > 1_500_000 {
		return domain.Profile{}, ErrInvalidPhoto
	}
	return e.repository.UpdatePhotoByUserID(ctx, actorID, input)
}
