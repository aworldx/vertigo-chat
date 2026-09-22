package postgres

import (
	"context"
	"fmt"
)

// ReserveNickname is called inside the entrance/registration transaction. The
// database remains the source of truth for both active and reconnecting names.
func (s Store) ReserveNickname(ctx context.Context, nickname string) (bool, error) {
	if _, err := s.pool.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 741103))`, nickname); err != nil {
		return false, fmt.Errorf("lock nickname: %w", err)
	}
	var occupied bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM chat_sessions WHERE nickname=$1 AND status IN ('active','reconnecting'))`, nickname).Scan(&occupied)
	return !occupied, err
}
