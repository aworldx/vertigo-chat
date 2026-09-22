package postgres

import (
	"chat/api/internal/emojis/application"
	"context"
)

func (s Store) Submit(ctx context.Context, u application.Upload) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO emojis(code,image,content_type,status,tags,user_id,width,height,animated,inserted_at,updated_at) VALUES($1,$2,$3,'pending','{}',$4,$5,$6,$7,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`, u.Code, u.Bytes, u.ContentType, u.UserID, u.Width, u.Height, u.Animated)
	return err
}
