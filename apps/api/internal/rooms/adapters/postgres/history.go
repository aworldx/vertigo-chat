package postgres

import (
	"chat/api/internal/rooms/domain"
	"context"
	"time"
)

func (s Store) History(ctx context.Context, room string, from, until time.Time, after int64, limit int, filters domain.HistoryFilters) ([]domain.Message, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM room_messages WHERE room_id=$1 AND sent_at >= $2 AND sent_at < $3 AND id > $4 AND kind IN ('text','gif','music','youtube','tetris','system') AND ($6='' OR (kind!='system' AND lower(author)=lower($6))) AND ($7='' OR (kind!='system' AND lower(recipient)=lower($7))) ORDER BY id LIMIT $5`, room, from, until, after, limit, filters.Author, filters.Recipient)
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
