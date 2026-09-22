package postgres

import (
	"chat/api/internal/rooms/application"
	"context"
	"encoding/json"
)

func (s Store) Reaction(ctx context.Context, room string, id int64, identity, nickname, emoji string, active bool) error {
	var author, kind string
	var raw []byte
	if err := s.db.QueryRow(ctx, `SELECT author,kind,reactions FROM room_messages WHERE id=$1 AND room_id=$2 FOR UPDATE`, id, room).Scan(&author, &kind, &raw); err != nil {
		return err
	}
	if author == nickname || author == "system" || (kind != "text" && kind != "gif") {
		return application.ErrActionDenied
	}
	reactions := map[string][]string{}
	if err := json.Unmarshal(raw, &reactions); err != nil {
		return err
	}
	values := make([]string, 0, len(reactions[emoji])+1)
	for _, actor := range reactions[emoji] {
		if actor != identity {
			values = append(values, actor)
		}
	}
	if active {
		values = append(values, identity)
	}
	reactions[emoji] = values
	raw, err := json.Marshal(reactions)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `UPDATE room_messages SET reactions=$2,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1`, id, raw)
	return err
}
func (s Store) Delete(ctx context.Context, room string, id int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM room_messages WHERE room_id=$1 AND id=$2 AND kind!='system'`, room, id)
	return err
}
