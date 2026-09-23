package postgres

import (
	"chat/api/internal/accounts/application"
	"context"
	"encoding/json"
)

func (a Accounts) PublicationProfile(ctx context.Context, id int64, lock bool) (application.PublicationProfile, error) {
	query := `SELECT nickname,public_message_count,chat_seconds FROM registered_users WHERE id=$1 AND NOT is_game_guest`
	if lock {
		query += ` FOR UPDATE`
	}
	var p application.PublicationProfile
	err := a.pool.QueryRow(ctx, query, id).Scan(&p.Nickname, &p.Messages, &p.Seconds)
	return p, err
}
func (a Accounts) PublicNames(ctx context.Context, ids []int64) (map[int64]string, error) {
	var raw []byte
	err := a.pool.QueryRow(ctx, `SELECT COALESCE(json_object_agg(id,nickname),'{}'::json) FROM registered_users WHERE id=ANY($1)`, ids).Scan(&raw)
	if err != nil {
		return nil, err
	}
	names := map[int64]string{}
	err = json.Unmarshal(raw, &names)
	return names, err
}
