package postgres

import (
	"chat/api/internal/chatsessions/domain"
	"context"
)

func (s Store) Authenticate(ctx context.Context, id, identity, secret string, generation int) (domain.Session, error) {
	var session domain.Session
	err := s.pool.QueryRow(ctx, `SELECT id,room_id,identity_key,nickname,status,generation,visit_id,reconnect_deadline_at FROM chat_sessions WHERE id=$1 AND identity_key=$2 AND resume_secret_hash=$3 AND generation=$4 AND status='active'`, id, identity, hashSecret(secret), generation).Scan(&session.ID, &session.RoomID, &session.IdentityKey, &session.Nickname, &session.Status, &session.Generation, &session.VisitID, &session.ReconnectDeadline)
	if err != nil {
		return session, domain.ErrInvalidSession
	}
	return session, nil
}
