package postgres

import (
	"chat/api/internal/gallery/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

type Database interface {
	Begin(context.Context) (pgx.Tx, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type UploadGate func(context.Context, pgx.Tx, int64) (bool, error)
type Storage interface {
	Save(context.Context, domain.Media, string) (domain.Media, error)
	Load(context.Context, string) ([]byte, error)
}
type Store struct {
	db      Database
	gate    UploadGate
	storage Storage
}

func NewStore(db Database, gate UploadGate, storage Storage) Store { return Store{db, gate, storage} }
func (s Store) List(ctx context.Context, user int64) ([]domain.Photo, error) {
	rows, err := s.db.Query(ctx, `SELECT p.id,p.user_id,COALESCE(p.caption,''),p.inserted_at,p.thumbnail IS NOT NULL OR p.thumbnail_key IS NOT NULL,(SELECT count(*) FROM gallery_photo_likes l WHERE l.photo_id=p.id),EXISTS(SELECT 1 FROM gallery_photo_likes l WHERE l.photo_id=p.id AND l.user_id=$1) FROM gallery_photos p ORDER BY p.inserted_at DESC,p.id DESC`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	photos := []domain.Photo{}
	for rows.Next() {
		var p domain.Photo
		if err := rows.Scan(&p.ID, &p.UserID, &p.Caption, &p.InsertedAt, &p.HasThumbnail, &p.Likes, &p.Liked); err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	return photos, rows.Err()
}
func (s Store) Add(ctx context.Context, user int64, u domain.Upload) (int64, error) {
	var id int64
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		allowed, err := s.gate(ctx, tx, user)
		if err != nil {
			return err
		}
		var total, daily int
		if err := tx.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE inserted_at >= (NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day') FROM gallery_photos WHERE user_id=$1`, user).Scan(&total, &daily); err != nil {
			return err
		}
		if err := domain.Quota(allowed, total, daily); err != nil {
			return err
		}
		u, err = s.persist(ctx, u)
		if err != nil {
			return err
		}
		return tx.QueryRow(ctx, `INSERT INTO gallery_photos(user_id,caption,image,content_type,image_key,thumbnail,thumbnail_content_type,thumbnail_key,inserted_at,updated_at) VALUES($1,NULLIF($2,''),$3,$4,NULLIF($5,''),$6,NULLIF($7,''),NULLIF($8,''),NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') RETURNING id`, user, u.Caption, u.Image.Bytes, u.Image.ContentType, u.Image.Key, u.Thumbnail.Bytes, u.Thumbnail.ContentType, u.Thumbnail.Key).Scan(&id)
	})
	return id, err
}
func (s Store) persist(ctx context.Context, u domain.Upload) (domain.Upload, error) {
	if s.storage == nil {
		return u, nil
	}
	var err error
	u.Image, err = s.storage.Save(ctx, u.Image, "image")
	if err != nil {
		return u, err
	}
	if len(u.Thumbnail.Bytes) > 0 {
		u.Thumbnail, err = s.storage.Save(ctx, u.Thumbnail, "thumbnail")
	}
	return u, err
}
func (s Store) Caption(ctx context.Context, user, id int64, value string) error {
	var found int64
	err := s.db.QueryRow(ctx, `UPDATE gallery_photos SET caption=NULLIF($3,''),updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND user_id=$2 RETURNING id`, id, user, value).Scan(&found)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return err
}
func (s Store) Like(ctx context.Context, user, id int64, active bool) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var owner int64
		err := tx.QueryRow(ctx, `SELECT user_id FROM gallery_photos WHERE id=$1 FOR UPDATE`, id).Scan(&owner)
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.ErrNotFound
		}
		if err != nil {
			return err
		}
		if owner == user {
			return domain.ErrForbidden
		}
		if active {
			_, err = tx.Exec(ctx, `INSERT INTO gallery_photo_likes(photo_id,user_id,inserted_at,updated_at) VALUES($1,$2,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') ON CONFLICT(photo_id,user_id) DO NOTHING`, id, user)
		} else {
			_, err = tx.Exec(ctx, `DELETE FROM gallery_photo_likes WHERE photo_id=$1 AND user_id=$2`, id, user)
		}
		return err
	})
}
func (s Store) Media(ctx context.Context, id int64, thumbnail bool) (domain.Media, error) {
	columns := `image,COALESCE(image_key,''),content_type`
	if thumbnail {
		columns = `thumbnail,COALESCE(thumbnail_key,''),COALESCE(thumbnail_content_type,'')`
	}
	var m domain.Media
	err := s.db.QueryRow(ctx, `SELECT `+columns+` FROM gallery_photos WHERE id=$1`, id).Scan(&m.Bytes, &m.Key, &m.ContentType)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, domain.ErrNotFound
	}
	if err != nil {
		return m, err
	}
	if m.Key != "" {
		if s.storage == nil {
			return m, domain.ErrUnavailable
		}
		m.Bytes, err = s.storage.Load(ctx, m.Key)
	}
	if err == nil && len(m.Bytes) == 0 {
		return m, domain.ErrNotFound
	}
	return m, err
}
