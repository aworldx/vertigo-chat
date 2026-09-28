package postgres

import "context"

func (s Store) PublishGame(ctx context.Context, room, id, author, body string) error {
	_, err := s.db.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,body,client_id,author_identity,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES($1,'tetris',$2,$3,$4,'system:tetris','vertigo','{}','{}','theme','normal',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') ON CONFLICT(room_id,author_identity,client_id) WHERE client_id IS NOT NULL DO UPDATE SET body=EXCLUDED.body,updated_at=EXCLUDED.updated_at`, room, author, body, id)
	return err
}
func (s Store) CancelGames(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `UPDATE room_messages SET body=jsonb_set(body::jsonb,'{status}','"cancelled"')::text WHERE kind='tetris' AND body::jsonb->>'status' IN ('lobby','countdown','running')`)
	return err
}
