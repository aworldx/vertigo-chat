package postgres

import (
	"chat/api/internal/notes/domain"
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Database interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db: db} }

func (s Store) Summary(ctx context.Context, user int64) (int, error) {
	var count int
	err := s.db.QueryRow(ctx, `SELECT count(*) FROM offline_notes WHERE recipient_id=$1 AND read_at IS NULL`, user).Scan(&count)
	return count, err
}
func (s Store) List(ctx context.Context, user int64) ([]domain.Note, []domain.Note, error) {
	incoming, err := s.list(ctx, `SELECT n.id,s.nickname,r.nickname,n.body,n.read_at,n.inserted_at FROM offline_notes n JOIN registered_users s ON s.id=n.sender_id JOIN registered_users r ON r.id=n.recipient_id WHERE n.recipient_id=$1 ORDER BY n.inserted_at DESC,n.id DESC`, user)
	if err != nil {
		return nil, nil, err
	}
	updated, err := s.db.Query(ctx, `UPDATE offline_notes SET read_at=COALESCE(read_at,NOW() AT TIME ZONE 'UTC') WHERE recipient_id=$1`, user)
	if err != nil {
		return nil, nil, err
	}
	updated.Close()
	outgoing, err := s.list(ctx, `SELECT n.id,s.nickname,r.nickname,n.body,n.read_at,n.inserted_at FROM offline_notes n JOIN registered_users s ON s.id=n.sender_id JOIN registered_users r ON r.id=n.recipient_id WHERE n.sender_id=$1 ORDER BY n.inserted_at DESC,n.id DESC`, user)
	return incoming, outgoing, err
}
func (s Store) list(ctx context.Context, query string, user int64) ([]domain.Note, error) {
	rows, err := s.db.Query(ctx, query, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := []domain.Note{}
	for rows.Next() {
		var v domain.Note
		if err := rows.Scan(&v.ID, &v.Sender, &v.Recipient, &v.Body, &v.ReadAt, &v.InsertedAt); err != nil {
			return nil, err
		}
		values = append(values, v)
	}
	return values, rows.Err()
}
func (s Store) Send(ctx context.Context, user int64, v domain.Input) (int64, error) {
	var id int64
	err := s.db.QueryRow(ctx, `WITH recipient AS (SELECT id FROM registered_users WHERE nickname=$2 AND NOT is_game_guest AND NOT is_bot), quota AS (SELECT count(*) AS sent FROM offline_notes WHERE sender_id=$1 AND inserted_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day') INSERT INTO offline_notes(sender_id,recipient_id,body) SELECT $1,recipient.id,$3 FROM recipient,quota WHERE recipient.id<>$1 AND quota.sent<30 RETURNING id`, user, v.Recipient, v.Body).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		var recipient int64
		lookup := s.db.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname=$1 AND NOT is_game_guest AND NOT is_bot`, v.Recipient).Scan(&recipient)
		if lookup != nil || recipient == user {
			return 0, domain.ErrRecipient
		}
		return 0, domain.ErrDaily
	}
	return id, err
}
