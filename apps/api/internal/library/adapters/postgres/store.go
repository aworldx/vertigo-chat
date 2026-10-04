package postgres

import (
	"chat/api/internal/library/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
)

type Database interface {
	Begin(context.Context) (pgx.Tx, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Gate func(context.Context, pgx.Tx, int64) (bool, error)
type Store struct {
	db   Database
	gate Gate
}

func NewStore(db Database, g Gate) Store { return Store{db, g} }
func (s Store) List(ctx context.Context, user, author int64, series string, bookmarks bool) ([]domain.Article, []domain.Series, error) {
	series = strings.TrimSpace(series)
	if author <= 0 {
		series = ""
	}
	order := `a.inserted_at DESC,a.id DESC`
	if series != "" {
		order = `a.part_number ASC NULLS LAST,a.inserted_at,a.id`
	}
	rows, err := s.db.Query(ctx, `SELECT a.id,a.user_id,a.title,a.body,COALESCE(a.series,''),a.part_number,a.inserted_at,a.work_author,a.source_url,a.cover_image,
 (SELECT count(*) FROM library_likes l WHERE l.article_id=a.id),
 EXISTS(SELECT 1 FROM library_likes l WHERE l.article_id=a.id AND l.user_id=$3),
 EXISTS(SELECT 1 FROM library_bookmarks b WHERE b.article_id=a.id AND b.user_id=$3)
 FROM library_articles a WHERE ($2='' OR (a.user_id=$1 AND a.series=$2))
 AND (NOT $4 OR EXISTS(SELECT 1 FROM library_bookmarks b WHERE b.article_id=a.id AND b.user_id=$3)) ORDER BY `+order, author, series, user, bookmarks)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	articles := []domain.Article{}
	for rows.Next() {
		var a domain.Article
		if err := rows.Scan(&a.ID, &a.UserID, &a.Title, &a.Body, &a.Series, &a.Part, &a.InsertedAt, &a.WorkAuthor, &a.SourceURL, &a.CoverImage, &a.Likes, &a.Liked, &a.Bookmarked); err != nil {
			return nil, nil, err
		}
		articles = append(articles, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	groups, err := s.db.Query(ctx, `SELECT a.user_id,a.series,count(*),COALESCE(s.description,'') FROM library_articles a LEFT JOIN library_series s ON s.user_id=a.user_id AND s.name=a.series WHERE a.series IS NOT NULL GROUP BY a.user_id,a.series,s.description ORDER BY a.series,a.user_id`)
	if err != nil {
		return nil, nil, err
	}
	defer groups.Close()
	result := []domain.Series{}
	for groups.Next() {
		var g domain.Series
		if err := groups.Scan(&g.UserID, &g.Name, &g.Count, &g.Description); err != nil {
			return nil, nil, err
		}
		result = append(result, g)
	}
	return articles, result, groups.Err()
}
func (s Store) Save(ctx context.Context, user, id int64, v domain.Input) (int64, error) {
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		if err := lockAuthor(ctx, tx, user); err != nil {
			return err
		}
		if err := validateCover(ctx, tx, user, v.CoverImage); err != nil {
			return err
		}
		if id > 0 {
			err := tx.QueryRow(ctx, `UPDATE library_articles SET title=$3,body=$4,series=NULLIF($5,''),part_number=$6,work_author=$7,cover_image=COALESCE($8,cover_image),updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND user_id=$2 RETURNING id`, id, user, v.Title, v.Body, v.Series, v.Part, v.WorkAuthor, v.CoverImage).Scan(&id)
			if errors.Is(err, pgx.ErrNoRows) {
				return domain.ErrForbidden
			}
			if err != nil {
				return err
			}
			return ensureSeries(ctx, tx, user, v.Series)
		}

		allowed, err := s.gate(ctx, tx, user)
		if err != nil {
			return err
		}
		var total, daily int
		if err := tx.QueryRow(ctx, `SELECT count(*),count(*) FILTER(WHERE inserted_at >= (NOW() AT TIME ZONE 'UTC')-INTERVAL '1 day') FROM library_articles WHERE user_id=$1`, user).Scan(&total, &daily); err != nil {
			return err
		}
		if err := domain.Quota(allowed, total, daily); err != nil {
			return err
		}
		if err := ensureSeries(ctx, tx, user, v.Series); err != nil {
			return err
		}
		return tx.QueryRow(ctx, `INSERT INTO library_articles(user_id,title,body,series,part_number,work_author,cover_image,inserted_at,updated_at) VALUES($1,$2,$3,NULLIF($4,''),$5,$6,COALESCE($7,''),NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') RETURNING id`, user, v.Title, v.Body, v.Series, v.Part, v.WorkAuthor, v.CoverImage).Scan(&id)
	})
	return id, err
}
