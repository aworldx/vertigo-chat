package postgres

import (
	"chat/api/internal/rooms/domain"
	"context"
	"github.com/jackc/pgx/v5"
)

type Database interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db} }

const columns = `id,COALESCE(client_id,''),kind,author,body,sent_at`

func (s Store) Send(ctx context.Context, author domain.Author, clientID, body string) (domain.Message, error) {
	var message domain.Message

	var limited bool
	err := s.db.QueryRow(ctx, `SELECT NOT EXISTS(SELECT 1 FROM room_messages WHERE room_id=$1 AND author_identity=$2 AND client_id=$3) AND (count(*) FILTER (WHERE sent_at>NOW()-interval '2 seconds')>=3 OR count(*)>=12) FROM room_messages WHERE room_id=$1 AND author_identity=$2 AND kind='text' AND sent_at>NOW()-interval '1 minute'`, author.RoomID, author.Identity, clientID).Scan(&limited)
	if err != nil {
		return message, err
	}
	if limited {
		return message, domain.ErrRateLimited
	}
	// Conflict returns the original body. Replayed outbox IDs never edit history.
	err = s.db.QueryRow(ctx, `INSERT INTO room_messages(room_id,kind,author,body,client_id,author_identity,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES($1,'text',$2,$3,$4,$5,'vertigo','{}','{}','theme','normal',NOW(),NOW(),NOW()) ON CONFLICT(room_id,author_identity,client_id) WHERE client_id IS NOT NULL DO UPDATE SET client_id=room_messages.client_id RETURNING `+columns+`,(xmax=0)`, author.RoomID, author.Nickname, body, clientID, author.Identity).Scan(&message.ID, &message.ClientID, &message.Kind, &message.Author, &message.Body, &message.SentAt, &message.Inserted)
	return message, err
}
func (s Store) Recent(ctx context.Context, roomID string) ([]domain.Message, error) {
	rows, err := s.db.Query(ctx, `SELECT `+columns+` FROM (SELECT * FROM room_messages WHERE room_id=$1 ORDER BY id DESC LIMIT 30) messages ORDER BY id`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := make([]domain.Message, 0, 30)
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.ID, &m.ClientID, &m.Kind, &m.Author, &m.Body, &m.SentAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}
