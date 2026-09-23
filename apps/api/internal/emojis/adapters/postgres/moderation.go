package postgres

import (
	"chat/api/internal/emojis/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (s Store) Managed(ctx context.Context) ([]domain.ManagedEmoji, []domain.Tag, error) {
	rows, err := s.pool.Query(ctx, `SELECT id,COALESCE(user_id,0),code,status,content_type,COALESCE(rejection_reason,''),COALESCE(width,32),COALESCE(height,32),animated,ARRAY(SELECT emoji_tag_id FROM emoji_tag_assignments WHERE emoji_id=e.id ORDER BY emoji_tag_id) FROM emojis e ORDER BY status,inserted_at DESC,id DESC`)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	emojis := []domain.ManagedEmoji{}
	for rows.Next() {
		var e domain.ManagedEmoji
		if err := rows.Scan(&e.ID, &e.UserID, &e.Code, &e.Status, &e.ContentType, &e.Reason, &e.Width, &e.Height, &e.Animated, &e.TagIDs); err != nil {
			return nil, nil, err
		}
		emojis = append(emojis, e)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	tags, err := s.pool.Query(ctx, `SELECT id,name,COALESCE(triggers,'{}') FROM emoji_tags ORDER BY name`)
	if err != nil {
		return nil, nil, err
	}
	defer tags.Close()
	result := []domain.Tag{}
	for tags.Next() {
		var t domain.Tag
		if err := tags.Scan(&t.ID, &t.Name, &t.Triggers); err != nil {
			return nil, nil, err
		}
		result = append(result, t)
	}
	return emojis, result, tags.Err()
}
func (s Store) Moderate(ctx context.Context, id int64, v domain.Moderation) error {
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `UPDATE emojis SET code=$2,status=$3,rejection_reason=NULLIF($4,''),tags=ARRAY(SELECT name FROM emoji_tags WHERE id=ANY($5) ORDER BY name),updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1`, id, v.Code, v.Status, v.Reason, v.TagIDs)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return domain.ErrNotFound
		}
		if _, err := tx.Exec(ctx, `DELETE FROM emoji_tag_assignments WHERE emoji_id=$1`, id); err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `INSERT INTO emoji_tag_assignments(emoji_id,emoji_tag_id) SELECT $1,id FROM emoji_tags WHERE id=ANY($2)`, id, v.TagIDs)
		return err
	})
	return moderationError(err)
}
func (s Store) Delete(ctx context.Context, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM emojis WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return err
}
func (s Store) SaveTag(ctx context.Context, t domain.Tag) (int64, error) {
	var query string
	if t.ID > 0 {
		query = `UPDATE emoji_tags SET name=$2,triggers=$3,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 RETURNING id`
	} else {
		query = `INSERT INTO emoji_tags(name,triggers,inserted_at,updated_at) SELECT $2,$3,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC' WHERE $1::bigint=0 RETURNING id`
	}
	err := s.pool.QueryRow(ctx, query, t.ID, t.Name, t.Triggers).Scan(&t.ID)
	return t.ID, moderationError(err)
}
func (s Store) DeleteTag(ctx context.Context, id int64) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM emoji_tags WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return err
}
func (s Store) ManagedImage(ctx context.Context, id int64) (domain.Image, error) {
	var i domain.Image
	err := s.pool.QueryRow(ctx, `SELECT image,COALESCE(image_key,''),content_type FROM emojis WHERE id=$1`, id).Scan(&i.Bytes, &i.Key, &i.ContentType)
	return i, moderationError(err)
}
func moderationError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return domain.ErrInvalid
	}
	return err
}
