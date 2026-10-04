package postgres

import (
	"chat/api/internal/library/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// Serialize article changes, series renames and image quotas for one publisher.
func lockAuthor(ctx context.Context, tx pgx.Tx, user int64) error {
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('library:' || $1::bigint::text,0))`, user)
	return err
}
func ensureSeries(ctx context.Context, tx pgx.Tx, user int64, name string) error {
	if name == "" {
		return nil
	}
	_, err := tx.Exec(ctx, `INSERT INTO library_series(user_id,name) VALUES($1,$2) ON CONFLICT DO NOTHING`, user, name)
	return err
}
func validateCover(ctx context.Context, tx pgx.Tx, user int64, cover *string) error {
	if cover == nil || domain.ImageID(*cover) == 0 {
		return nil
	}
	var own bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM library_images WHERE id=$1 AND user_id=$2)`, domain.ImageID(*cover), user).Scan(&own)
	if err != nil {
		return err
	}
	if !own {
		return domain.ErrInvalid
	}
	return nil
}
func (s Store) UpdateSeries(ctx context.Context, user int64, v domain.SeriesInput) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := lockAuthor(ctx, tx, user); err != nil {
			return err
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM library_articles WHERE user_id=$1 AND series=$2)`, user, v.OriginalName).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return domain.ErrNotFound
		}
		if v.Name != v.OriginalName {
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM library_series WHERE user_id=$1 AND name=$2) OR EXISTS(SELECT 1 FROM library_articles WHERE user_id=$1 AND series=$2)`, user, v.Name).Scan(&exists); err != nil {
				return err
			}
			if exists {
				return domain.ErrSeriesConflict
			}
		}
		if err := ensureSeries(ctx, tx, user, v.OriginalName); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `UPDATE library_series SET name=$3,description=$4 WHERE user_id=$1 AND name=$2`, user, v.OriginalName, v.Name, v.Description); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `UPDATE library_articles SET series=$3,updated_at=NOW() AT TIME ZONE 'UTC' WHERE user_id=$1 AND series=$2`, user, v.OriginalName, v.Name)
		return err
	})
}
func (s Store) Reaction(ctx context.Context, user, id int64, kind string, active bool) error {
	table := "library_likes"
	if kind == "bookmark" {
		table = "library_bookmarks"
	}
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM library_articles WHERE id=$1)`, id).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return domain.ErrNotFound
		}
		if active {
			_, err := tx.Exec(ctx, `INSERT INTO `+table+`(article_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, id, user)
			return err
		}
		_, err := tx.Exec(ctx, `DELETE FROM `+table+` WHERE article_id=$1 AND user_id=$2`, id, user)
		return err
	})
}
func (s Store) AddImage(ctx context.Context, user int64, v domain.Image) (int64, error) {
	var id int64
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := lockAuthor(ctx, tx, user); err != nil {
			return err
		}
		allowed, err := s.gate(ctx, tx, user)
		if err != nil {
			return err
		}
		if !allowed {
			var ownsArticle bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM library_articles WHERE user_id=$1)`, user).Scan(&ownsArticle); err != nil {
				return err
			}
			if !ownsArticle {
				return domain.ErrRank
			}
		}
		var total, daily int
		if err := tx.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE inserted_at>=now()-INTERVAL '1 day') FROM library_images WHERE user_id=$1`, user).Scan(&total, &daily); err != nil {
			return err
		}
		if total >= 200 || daily >= 30 {
			return domain.ErrImageQuota
		}
		return tx.QueryRow(ctx, `INSERT INTO library_images(user_id,image,content_type) VALUES($1,$2,$3) RETURNING id`, user, v.Bytes, v.ContentType).Scan(&id)
	})
	return id, err
}
func (s Store) Image(ctx context.Context, id int64) (domain.Image, error) {
	var v domain.Image
	err := s.db.QueryRow(ctx, `SELECT image,content_type FROM library_images WHERE id=$1`, id).Scan(&v.Bytes, &v.ContentType)
	if errors.Is(err, pgx.ErrNoRows) {
		err = domain.ErrNotFound
	}
	return v, err
}
