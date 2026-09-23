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
func (s Store) List(ctx context.Context, author int64, series string) ([]domain.Article, []domain.Series, error) {
	series = strings.TrimSpace(series)
	if author <= 0 {
		series = ""
	}
	order := `inserted_at DESC,id DESC`
	if series != "" {
		order = `part_number ASC NULLS LAST,inserted_at,id`
	}
	rows, err := s.db.Query(ctx, `SELECT id,user_id,title,body,COALESCE(series,''),part_number,inserted_at FROM library_articles WHERE $2='' OR (user_id=$1 AND series=$2) ORDER BY `+order, author, series)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	articles := []domain.Article{}
	for rows.Next() {
		var a domain.Article
		if err := rows.Scan(&a.ID, &a.UserID, &a.Title, &a.Body, &a.Series, &a.Part, &a.InsertedAt); err != nil {
			return nil, nil, err
		}
		articles = append(articles, a)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	groups, err := s.db.Query(ctx, `SELECT user_id,series,count(*) FROM library_articles WHERE series IS NOT NULL GROUP BY user_id,series ORDER BY series,user_id`)
	if err != nil {
		return nil, nil, err
	}
	defer groups.Close()
	result := []domain.Series{}
	for groups.Next() {
		var g domain.Series
		if err := groups.Scan(&g.UserID, &g.Name, &g.Count); err != nil {
			return nil, nil, err
		}
		result = append(result, g)
	}
	return articles, result, groups.Err()
}
func (s Store) Save(ctx context.Context, user, id int64, v domain.Input) (int64, error) {
	if id > 0 {
		err := s.db.QueryRow(ctx, `UPDATE library_articles SET title=$3,body=$4,series=NULLIF($5,''),part_number=$6,updated_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND user_id=$2 RETURNING id`, id, user, v.Title, v.Body, v.Series, v.Part).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			err = domain.ErrForbidden
		}
		return id, err
	}
	err := pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
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
		return tx.QueryRow(ctx, `INSERT INTO library_articles(user_id,title,body,series,part_number,inserted_at,updated_at) VALUES($1,$2,$3,NULLIF($4,''),$5,NOW() AT TIME ZONE 'UTC',NOW() AT TIME ZONE 'UTC') RETURNING id`, user, v.Title, v.Body, v.Series, v.Part).Scan(&id)
	})
	return id, err
}
