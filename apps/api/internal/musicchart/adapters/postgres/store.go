package postgres

import (
	"chat/api/internal/musicchart/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ pool *pgxpool.Pool }

func NewStore(p *pgxpool.Pool) Store { return Store{p} }
func (s Store) List(ctx context.Context, user int64) ([]domain.Track, error) {
	rows, err := s.pool.Query(ctx, `SELECT t.id,t.title,u.nickname,t.user_id=$1,(SELECT count(*) FROM music_chart_likes l WHERE l.track_id=t.id),EXISTS(SELECT 1 FROM music_chart_likes l WHERE l.track_id=t.id AND l.user_id=$1) FROM music_chart_tracks t JOIN registered_users u ON u.id=t.user_id ORDER BY 5 DESC,t.inserted_at DESC,t.id DESC`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tracks := make([]domain.Track, 0)
	for rows.Next() {
		var t domain.Track
		if err := rows.Scan(&t.ID, &t.Title, &t.Author, &t.Own, &t.Likes, &t.Liked); err != nil {
			return nil, err
		}
		t.Comments = []domain.Comment{}
		tracks = append(tracks, t)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	comments, err := s.pool.Query(ctx, `SELECT c.track_id,c.id,u.nickname,c.body FROM music_chart_comments c JOIN registered_users u ON u.id=c.user_id ORDER BY c.inserted_at,c.id`)
	if err != nil {
		return nil, err
	}
	defer comments.Close()
	indexes := map[int64]int{}
	for i, t := range tracks {
		indexes[t.ID] = i
	}
	for comments.Next() {
		var id int64
		var c domain.Comment
		if err := comments.Scan(&id, &c.ID, &c.Author, &c.Body); err != nil {
			return nil, err
		}
		if i, ok := indexes[id]; ok {
			tracks[i].Comments = append(tracks[i].Comments, c)
		}
	}
	return tracks, comments.Err()
}
func (s Store) Audio(ctx context.Context, id int64) (domain.Audio, error) {
	var a domain.Audio
	err := s.pool.QueryRow(ctx, `SELECT audio,COALESCE(audio_key,''),content_type FROM music_chart_tracks WHERE id=$1`, id).Scan(&a.Bytes, &a.Key, &a.ContentType)
	if errors.Is(err, pgx.ErrNoRows) {
		err = domain.ErrNotFound
	}
	return a, err
}
func (s Store) Add(ctx context.Context, user int64, title string, a domain.Audio) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, user); err != nil {
			return err
		}
		var count int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM music_chart_tracks WHERE user_id=$1`, user).Scan(&count); err != nil {
			return err
		}
		if count >= domain.MaxTracks {
			return domain.ErrLimit
		}
		_, err := tx.Exec(ctx, `INSERT INTO music_chart_tracks(user_id,title,audio,content_type,audio_key,inserted_at,updated_at) VALUES($1,$2,$3,$4,NULLIF($5,''),NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC')`, user, title, a.Bytes, a.ContentType, a.Key)
		return err
	})
}
func (s Store) Rename(ctx context.Context, user, id int64, title string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE music_chart_tracks SET title=$3,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND user_id=$2`, id, user, title)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrForbidden
	}
	return err
}
func (s Store) Like(ctx context.Context, user, id int64, active bool) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		var owner int64
		if err := tx.QueryRow(ctx, `SELECT user_id FROM music_chart_tracks WHERE id=$1 FOR UPDATE`, id).Scan(&owner); err != nil {
			return domain.ErrNotFound
		}
		if owner == user {
			return domain.ErrForbidden
		}
		if active {
			_, err := tx.Exec(ctx, `INSERT INTO music_chart_likes(track_id,user_id,inserted_at,updated_at) VALUES($1,$2,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') ON CONFLICT(track_id,user_id) DO NOTHING`, id, user)
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM music_chart_likes WHERE track_id=$1 AND user_id=$2`, id, user)
		return err
	})
}
func (s Store) Comment(ctx context.Context, user, id int64, body string) error {
	tag, err := s.pool.Exec(ctx, `INSERT INTO music_chart_comments(track_id,user_id,body,inserted_at,updated_at) SELECT id,$2,$3,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC' FROM music_chart_tracks WHERE id=$1`, id, user, body)
	if err == nil && tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return err
}
