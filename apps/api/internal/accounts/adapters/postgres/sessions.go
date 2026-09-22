package postgres

import (
	"context"
	"errors"
	"time"

	"chat/api/internal/accounts/application"
	"github.com/jackc/pgx/v5"
)

func (a Accounts) FindSession(ctx context.Context, digest string, now time.Time) (application.SessionRecord, error) {
	var record application.SessionRecord
	err := a.pool.QueryRow(ctx, `SELECT token_digest, COALESCE(user_id, 0), expires_at FROM account_sessions WHERE token_digest = $1 AND expires_at > $2`, digest, now).Scan(&record.Digest, &record.UserID, &record.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return record, application.ErrInvalidSession
	}
	return record, err
}

func (a Accounts) ReplaceSession(ctx context.Context, previous string, next application.SessionRecord, now time.Time) error {
	return pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		if previous != "" {
			result, err := tx.Exec(ctx, `DELETE FROM account_sessions WHERE token_digest = $1 AND expires_at > $2`, previous, now)
			if err != nil {
				return err
			}
			if result.RowsAffected() != 1 {
				return application.ErrInvalidSession
			}
		}
		_, err := tx.Exec(ctx, `INSERT INTO account_sessions (token_digest, user_id, expires_at) VALUES ($1, NULLIF($2, 0), $3)`, next.Digest, next.UserID, next.ExpiresAt)
		return err
	})
}

func (a Accounts) RevokeSession(ctx context.Context, digest string) error {
	_, err := a.pool.Exec(ctx, `DELETE FROM account_sessions WHERE token_digest = $1`, digest)
	return err
}

func (a Accounts) PruneSessions(ctx context.Context, now time.Time) error {
	return pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM account_sessions WHERE expires_at <= $1`, now); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM security_registration_guards WHERE day < $1::date`, now.Add(-48*time.Hour))
		return err
	})
}
