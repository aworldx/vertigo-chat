package postgres

import "context"

func (a Accounts) BotUserID(ctx context.Context, nickname string) (int64, error) {
	var id int64
	err := a.pool.QueryRow(ctx, `SELECT id FROM registered_users WHERE nickname=$1 AND is_bot`, nickname).Scan(&id)
	return id, err
}

// The guarded update counts online time once across replicas and excludes downtime.
func (a Accounts) TickBotPresence(ctx context.Context) error {
	_, err := a.pool.Exec(ctx, `UPDATE registered_users SET
 chat_seconds=chat_seconds+CASE WHEN bot_seen_at >= now()-interval '90 seconds'
 THEN GREATEST(EXTRACT(EPOCH FROM (now()-bot_seen_at))::integer,0) ELSE 0 END,
 bot_seen_at=now()
 WHERE is_bot AND (bot_seen_at IS NULL OR bot_seen_at <= now()-interval '30 seconds')`)
	return err
}
