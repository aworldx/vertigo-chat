package postgres

import (
	"chat/api/internal/rooms/application"
	"chat/api/internal/rooms/domain"
	"context"
)

func (s Store) SendMedia(ctx context.Context, author domain.Author, clientID, kind, title, address, artist, duration, source string) (domain.Message, error) {
	message, err := application.NewService(s).Send(ctx, author, clientID, title)
	if err != nil || !message.Inserted {
		return message, err
	}
	_, err = s.db.Exec(ctx, `UPDATE room_messages SET kind=$2,media_url=$3,media_artist=$4,media_duration=$5,media_source_url=$6 WHERE id=$1`, message.ID, kind, address, artist, duration, source)
	message.Kind = kind
	message.MediaURL = address
	message.Artist = artist
	message.Duration = duration
	message.SourceURL = source
	return message, err
}
