package postgres

import (
	"chat/api/internal/chatsessions/domain"
	"context"
)

func (s Store) Presence(ctx context.Context, roomID string) ([]domain.Session, error) {
	return s.sessions(ctx, "list room sessions", `SELECT id,room_id,identity_key,nickname,status,generation,visit_id,reconnect_deadline_at FROM chat_sessions WHERE room_id=$1 AND status IN ('active','reconnecting') ORDER BY nickname`, roomID)
}
