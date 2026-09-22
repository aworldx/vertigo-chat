package postgres

import (
	"chat/api/internal/accounts/application"
	"context"
)

func (a Accounts) ChatProfile(ctx context.Context, id int64) (application.ChatProfile, error) {
	var p application.ChatProfile
	err := a.pool.QueryRow(ctx, `SELECT id,nickname,is_admin,public_message_count,chat_seconds,karma,jsonb_build_object('theme_id',theme_id,'appearance',appearance,'font_id',font_id,'font_style',font_style,'message_sound_enabled',message_sound_enabled) FROM registered_users WHERE id=$1 AND NOT is_game_guest`, id).Scan(&p.UserID, &p.Nickname, &p.Admin, &p.PublicMessages, &p.ChatSeconds, &p.Karma, &p.Preferences)
	return p, err
}
func (a Accounts) SavePreferences(ctx context.Context, id int64, p []byte) error {
	_, err := a.pool.Exec(ctx, `UPDATE registered_users SET theme_id=$2::jsonb->>'theme_id',appearance=$2::jsonb->'appearance',font_id=$2::jsonb->>'font_id',font_style=$2::jsonb->>'font_style',message_sound_enabled=($2::jsonb->>'message_sound_enabled')::boolean,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1`, id, p)
	return err
}
