package postgres

import (
	"chat/api/internal/rooms/domain"
	"context"
)

func (s Store) RecentText(ctx context.Context, before int64) ([]domain.Message, error) {
	rows, err := s.db.Query(ctx, `SELECT id,author,body FROM(SELECT id,author,body FROM room_messages WHERE room_id='lobby' AND kind='text' AND ($1::bigint=0 OR id<$1) ORDER BY id DESC LIMIT 12)t ORDER BY id`, before)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	messages := []domain.Message{}
	for rows.Next() {
		var m domain.Message
		if err := rows.Scan(&m.ID, &m.Author, &m.Body); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}
func (s Store) AnnounceAssessment(ctx context.Context, nickname string, delta int) error {
	body := "Кармик дарит для " + nickname + " сердечко — рейтинг повышен на 1."
	if delta < 0 {
		body = "Кармик сердито машет хвостом: " + nickname + ", рейтинг понижен на 1."
	}
	_, err := s.db.Exec(ctx, `INSERT INTO room_messages(room_id,kind,author,body,theme_id,appearance,reactions,font_id,font_style,sent_at,inserted_at,updated_at) VALUES('lobby','system','system',$1,'vertigo','{}','{}','theme','normal',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`, body)
	return err
}
