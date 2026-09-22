package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (a Accounts) FindKarmaUser(ctx context.Context, nickname string) (int64, error) {
	var id int64
	err := a.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname=$1 AND NOT is_game_guest`, nickname).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return id, err
}
func (a Accounts) ChangeKarma(ctx context.Context, user int64, delta int) error {
	_, err := a.pool.Exec(ctx, `UPDATE registered_users SET karma=karma+$2,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1`, user, delta)
	return err
}
