package postgres

import (
	"chat/api/internal/karmik/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type Database interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db} }
func (s Store) Eligible(ctx context.Context, user, id int64) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx, `SELECT NOT EXISTS(SELECT 1 FROM karmik_assessments WHERE user_id=$1 AND room_message_id=$2) AND (SELECT count(*) FROM karmik_assessments WHERE user_id=$1 AND assessed_on=(NOW() AT TIME ZONE 'UTC')::date)<2`, user, id).Scan(&ok)
	return ok, err
}
func (s Store) Record(ctx context.Context, m domain.Message, a domain.Assessment, delta int) error {
	_, err := s.db.Exec(ctx, `INSERT INTO karmik_assessments(user_id,room_message_id,delta,assessed_on,chatlan_nickname,message_body,verdict,reason,inserted_at,updated_at) VALUES($1,$2,$3,(NOW() AT TIME ZONE 'UTC')::date,$4,$5,$6,$7,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`, m.UserID, m.ID, delta, m.Author, m.Body, a.Verdict, a.Reason)
	return err
}
