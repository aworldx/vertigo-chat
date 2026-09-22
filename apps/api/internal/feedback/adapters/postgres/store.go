package postgres

import (
	"chat/api/internal/feedback/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) Store { return Store{pool} }
func (s Store) Save(ctx context.Context, e domain.Entry) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, "feedback:"+e.Identity); err != nil {
			return err
		}
		var limited bool
		if err := tx.QueryRow(ctx, `SELECT count(*) FILTER(WHERE sent_at>now()-interval '1 minute')>=2 OR count(*)>=8 FROM feedback_rate_events WHERE identity_key=$1 AND sent_at>now()-interval '1 hour'`, e.Identity).Scan(&limited); err != nil {
			return err
		}
		if limited {
			return domain.ErrLimited
		}
		if _, err := tx.Exec(ctx, `INSERT INTO feedback_entries(user_id,name,body,inserted_at,updated_at) VALUES(NULLIF($1,0),$2,$3,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`, e.UserID, e.Name, e.Body); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM feedback_rate_events WHERE sent_at<now()-interval '1 hour'`); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO feedback_rate_events(identity_key,sent_at) VALUES($1,now())`, e.Identity)
		return err
	})
}
