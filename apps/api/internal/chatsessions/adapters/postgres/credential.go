package postgres

import (
	"chat/api/internal/chatsessions/domain"
	"context"
	"time"
)

func (s Store) Verify(ctx context.Context, id, key, secret string, now time.Time) (domain.Session, error) {
	var session domain.Session
	err := s.pool.QueryRow(ctx, `SELECT id,room_id,identity_key,nickname,status,generation,visit_id,reconnect_deadline_at FROM chat_sessions WHERE id=$1 AND identity_key=$2 AND resume_secret_hash=$3 AND ((status='active' AND last_seen_at>$4::timestamp-interval '180 seconds') OR (status='reconnecting' AND reconnect_deadline_at>$4))`, id, key, hashSecret(secret), now.UTC()).Scan(&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline)
	return session, err
}
