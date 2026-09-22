package postgres

import (
	"chat/api/internal/accounts/application"
	"context"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (a Accounts) ReadEmail(ctx context.Context, id int64) (*string, error) {
	var email *string
	err := a.pool.QueryRow(ctx, `SELECT email FROM registered_users WHERE id=$1 AND NOT is_game_guest`, id).Scan(&email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, application.ErrAccountNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("read account email: %w", err)
	}
	return email, nil
}
func (a Accounts) UpdateEmail(ctx context.Context, id int64, email string) error {
	result, err := a.pool.Exec(ctx, `UPDATE registered_users SET email=$2,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND NOT is_game_guest`, id, email)
	var constraint *pgconn.PgError
	if errors.As(err, &constraint) && constraint.Code == "23505" && constraint.ConstraintName == "registered_users_lower_email_index" {
		return application.ErrEmailTaken
	}
	if err != nil {
		return fmt.Errorf("update account email: %w", err)
	}
	if result.RowsAffected() != 1 {
		return application.ErrAccountNotFound
	}
	return nil
}
