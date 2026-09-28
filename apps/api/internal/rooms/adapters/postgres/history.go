package postgres

import (
	"chat/api/internal/rooms/domain"
	"context"
	"time"
)

func (s Store) History(ctx context.Context, room string, from, until time.Time, after int64, limit int) ([]domain.Message, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM room_messages WHERE room_id=$1 AND sent_at >= $2 AND sent_at < $3 AND id > $4 AND kind IN ('text','gif','music','youtube','tetris','system') ORDER BY id LIMIT $5`, room, from, until, after, limit)
	if err != nil {
		return nil, err
	}
	return readMessages(rows)
}

// Bound each cleanup transaction; the minute worker catches up on old archives.
func (s Store) Prune(ctx context.Context, cutoff time.Time) error {
	_, err := s.db.Exec(ctx, `DELETE FROM room_messages WHERE id IN (SELECT id FROM room_messages WHERE sent_at < $1 ORDER BY sent_at LIMIT 5000)`, cutoff)
	return err
}
