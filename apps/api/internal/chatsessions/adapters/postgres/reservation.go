package postgres

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"fmt"
)

// ReserveNickname is called inside the entrance/registration transaction. The
// database remains the source of truth for both active and reconnecting names.
func (s Store) ReserveNickname(ctx context.Context, nickname string) (bool, error) {
	if err := s.LockNickname(ctx, nickname); err != nil {
		return false, err
	}
	var occupied bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM chat_sessions WHERE nickname=$1 AND status IN ('active','reconnecting'))`, nickname).Scan(&occupied)
	return !occupied, err
}

func (s Store) LockNickname(ctx context.Context, nickname string) error {
	if _, err := s.pool.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 741103))`, nickname); err != nil {
		return fmt.Errorf("lock nickname: %w", err)
	}
	return nil
}
func (s Store) SessionsForNickname(ctx context.Context, nickname string) ([]domain.Session, error) {
	return s.sessions(ctx, "list occupied nickname", `SELECT id,room_id,identity_key,nickname,status,generation,visit_id,reconnect_deadline_at FROM chat_sessions WHERE nickname=$1 AND status IN ('active','reconnecting') FOR UPDATE`, nickname)
}
