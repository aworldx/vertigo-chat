package postgres

import "context"

func (a Accounts) IncrementPublicMessages(ctx context.Context, userID int64) error {
	_, err := a.pool.Exec(ctx, `UPDATE registered_users SET public_message_count=public_message_count+1 WHERE id=$1`, userID)
	return err
}
