// Package postgres adapts the existing PostgreSQL profile schema to application ports.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"math"

	"chat/api/internal/profiles/application"
	"chat/api/internal/profiles/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Catalogue struct {
	pool  *pgxpool.Pool
	media mediaStore
}

func NewCatalogue(pool *pgxpool.Pool) Catalogue { return Catalogue{pool: pool, media: databaseMedia{}} }

func NewCatalogueWithMedia(pool *pgxpool.Pool, media mediaStore) Catalogue {
	return Catalogue{pool: pool, media: media}
}

func (c Catalogue) List(ctx context.Context, query string, page, size int) (domain.Page, error) {
	const countSQL = `SELECT count(*) FROM profiles p JOIN registered_users u ON u.id = p.user_id
		WHERE ($1 = '' OR u.nickname ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%')`
	var total int
	if err := c.pool.QueryRow(ctx, countSQL, query).Scan(&total); err != nil {
		return domain.Page{}, fmt.Errorf("count profiles: %w", err)
	}
	totalPages := max(int(math.Ceil(float64(total)/float64(size))), 1)
	page = min(page, totalPages)
	rows, err := c.pool.Query(ctx, profileSQL+` WHERE ($1 = '' OR u.nickname ILIKE '%' || $1 || '%' OR p.name ILIKE '%' || $1 || '%') ORDER BY u.nickname ASC LIMIT $2 OFFSET $3`, query, size, (page-1)*size)
	if err != nil {
		return domain.Page{}, fmt.Errorf("list profiles: %w", err)
	}
	defer rows.Close()
	profiles, err := collect(rows)
	if err != nil {
		return domain.Page{}, err
	}
	return domain.Page{Profiles: profiles, Number: page, Size: size, Total: total, TotalPages: totalPages}, nil
}

func (c Catalogue) GetByNickname(ctx context.Context, nickname string) (domain.Profile, error) {
	rows, err := c.pool.Query(ctx, profileSQL+` WHERE u.nickname = $1`, nickname)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("get profile: %w", err)
	}
	defer rows.Close()
	profiles, err := collect(rows)
	if err != nil {
		return domain.Profile{}, err
	}
	if len(profiles) == 0 {
		return domain.Profile{}, application.ErrNotFound
	}
	return profiles[0], nil
}

func (c Catalogue) UpdateByUserID(ctx context.Context, userID int64, input domain.UpdateInput) (domain.Profile, error) {
	const updateSQL = `UPDATE profiles SET
 name = CASE WHEN $2 THEN $3::text ELSE name END,
 birth_date = CASE WHEN $4 THEN $5::date ELSE birth_date END,
 gender = CASE WHEN $6 THEN $7::text ELSE gender END,
 about = CASE WHEN $8 THEN $9::text ELSE about END,
 updated_at = NOW()
 WHERE user_id = $1`
	result, err := c.pool.Exec(ctx, updateSQL,
		userID,
		input.Name.Set, input.Name.Value,
		input.BirthDate.Set, input.BirthDate.Value,
		input.Gender.Set, input.Gender.Value,
		input.About.Set, input.About.Value,
	)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("update profile: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.Profile{}, application.ErrNotFound
	}
	return c.getByUserID(ctx, userID)
}

func (c Catalogue) UpdatePhotoByUserID(ctx context.Context, userID int64, input domain.PhotoInput) (domain.Profile, error) {
	thumbnailBytes, err := thumbnail(ctx, input.Bytes, input.ContentType)
	if err != nil {
		return domain.Profile{}, application.ErrInvalidPhoto
	}
	photo, preview, err := c.media.store(ctx, input, thumbnailBytes)
	if err != nil {
		return domain.Profile{}, errStorageUnavailable
	}
	const updateSQL = `UPDATE profiles SET photo = $2, photo_key = $3, photo_content_type = $4,
 thumbnail = $5, thumbnail_key = $6, thumbnail_content_type = $7, updated_at = NOW() WHERE user_id = $1`
	result, err := c.pool.Exec(ctx, updateSQL, userID, photo.bytes, photo.key, photo.contentType, preview.bytes, preview.key, preview.contentType)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("update profile photo: %w", err)
	}
	if result.RowsAffected() != 1 {
		return domain.Profile{}, application.ErrNotFound
	}
	return c.getByUserID(ctx, userID)
}

func (c Catalogue) MediaByNickname(ctx context.Context, nickname string, thumbnail bool) (domain.Media, error) {
	field := "photo"
	if thumbnail {
		field = "thumbnail"
	}
	query := `SELECT p.` + field + `, p.` + field + `_key, p.` + field + `_content_type
		FROM profiles p JOIN registered_users u ON u.id = p.user_id WHERE u.nickname = $1`
	var bytes []byte
	var key, contentType *string
	if err := c.pool.QueryRow(ctx, query, nickname).Scan(&bytes, &key, &contentType); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Media{}, application.ErrNotFound
		}
		return domain.Media{}, fmt.Errorf("get profile media: %w", err)
	}
	if contentType == nil {
		return domain.Media{}, application.ErrNotFound
	}
	if len(bytes) > 0 {
		return domain.Media{Bytes: bytes, ContentType: *contentType}, nil
	}
	if key == nil {
		return domain.Media{}, application.ErrNotFound
	}
	loaded, err := c.media.load(ctx, *key)
	if err != nil {
		return domain.Media{}, err
	}
	return domain.Media{Bytes: loaded, ContentType: *contentType}, nil
}

func (c Catalogue) getByUserID(ctx context.Context, userID int64) (domain.Profile, error) {
	rows, err := c.pool.Query(ctx, profileSQL+` WHERE u.id = $1`, userID)
	if err != nil {
		return domain.Profile{}, fmt.Errorf("get profile by user: %w", err)
	}
	defer rows.Close()
	profiles, err := collect(rows)
	if err != nil {
		return domain.Profile{}, err
	}
	if len(profiles) == 0 {
		return domain.Profile{}, application.ErrNotFound
	}
	return profiles[0], nil
}

const profileSQL = `SELECT u.nickname, p.name, p.birth_date::text, p.gender, p.about,
 (p.photo IS NOT NULL OR p.photo_key IS NOT NULL), (p.thumbnail IS NOT NULL OR p.thumbnail_key IS NOT NULL),
 u.public_message_count, u.chat_seconds FROM profiles p JOIN registered_users u ON u.id = p.user_id`

func collect(rows pgx.Rows) ([]domain.Profile, error) {
	profiles := make([]domain.Profile, 0)
	for rows.Next() {
		var profile domain.Profile
		if err := rows.Scan(&profile.Nickname, &profile.Name, &profile.BirthDate, &profile.Gender, &profile.About, &profile.HasPhoto, &profile.HasThumbnail, &profile.PublicMessageCount, &profile.ChatSeconds); err != nil {
			return nil, fmt.Errorf("scan profile: %w", err)
		}
		profiles = append(profiles, profile)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate profiles: %w", err)
	}
	return profiles, nil
}

var _ application.Catalogue = Catalogue{}
var _ application.Updater = Catalogue{}
var _ application.PhotoUpdater = Catalogue{}
var _ application.MediaReader = Catalogue{}
