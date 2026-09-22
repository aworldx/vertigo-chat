package application

import (
	"context"

	"chat/api/internal/profiles/domain"
)

type MediaReader interface {
	MediaByNickname(context.Context, string, bool) (domain.Media, error)
}

type MediaService struct{ reader MediaReader }

func NewMediaService(reader MediaReader) MediaService { return MediaService{reader: reader} }

func (s MediaService) Read(ctx context.Context, nickname string, thumbnail bool) (domain.Media, error) {
	return s.reader.MediaByNickname(ctx, nickname, thumbnail)
}
