package postgres

import (
	"context"
	"time"
)

func (s Store) LastMediaByAuthor(ctx context.Context, room, identity string) (time.Time, error) {
	var last *time.Time
	err := s.db.QueryRow(ctx, `SELECT max(sent_at) FROM room_messages WHERE room_id=$1 AND author_identity=$2 AND kind IN ('music','youtube')`, room, identity).Scan(&last)
	if last == nil {
		return time.Time{}, err
	}
	return *last, err
}
