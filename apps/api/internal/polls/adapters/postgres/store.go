package postgres

import (
	"chat/api/internal/polls/domain"
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type Database interface {
	Begin(context.Context) (pgx.Tx, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}
type Store struct{ db Database }

func NewStore(db Database) Store { return Store{db} }

func (s Store) Create(ctx context.Context, actor int64, input domain.Input) (domain.Poll, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return domain.Poll{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var p domain.Poll
	if err = tx.QueryRow(ctx, `INSERT INTO polls(question,created_by) VALUES($1,$2) RETURNING id,question,status,created_at`, input.Question, actor).Scan(&p.ID, &p.Question, &p.Status, &p.CreatedAt); err != nil {
		return p, err
	}
	for i, body := range input.Options {
		if _, err = tx.Exec(ctx, `INSERT INTO poll_options(poll_id,body,position) VALUES($1,$2,$3)`, p.ID, body, i+1); err != nil {
			return p, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return p, err
	}
	return p, nil
}
func (s Store) List(ctx context.Context, nickname string) ([]domain.Poll, error) {
	rows, err := s.db.Query(ctx, `SELECT p.id,p.question,p.status,p.created_at,p.closed_at,o.id,o.body,o.position,count(v.option_id),sum(count(v.option_id)) OVER (PARTITION BY p.id),COALESCE(max(v.option_id) FILTER (WHERE v.nickname=$1),0) FROM polls p JOIN poll_options o ON o.poll_id=p.id LEFT JOIN poll_votes v ON v.option_id=o.id GROUP BY p.id,o.id ORDER BY (p.status='open') DESC,p.created_at DESC,o.position`, nickname)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	values := []domain.Poll{}
	index := map[int64]int{}
	for rows.Next() {
		var p domain.Poll
		var o domain.Option
		var selected int64
		if err := rows.Scan(&p.ID, &p.Question, &p.Status, &p.CreatedAt, &p.ClosedAt, &o.ID, &o.Body, &o.Position, &o.Votes, &p.TotalVotes, &selected); err != nil {
			return nil, err
		}
		i, ok := index[p.ID]
		if !ok {
			i = len(values)
			index[p.ID] = i
			values = append(values, p)
		}
		if selected != 0 {
			values[i].SelectedOptionID = selected
		}
		values[i].Options = append(values[i].Options, o)
	}
	return values, rows.Err()
}
func (s Store) Vote(ctx context.Context, pollID int64, nickname string, optionID int64) error {
	var inserted int
	err := s.db.QueryRow(ctx, `INSERT INTO poll_votes(poll_id,nickname,option_id) SELECT p.id,$2,o.id FROM polls p JOIN poll_options o ON o.id=$3 AND o.poll_id=p.id WHERE p.id=$1 AND p.status='open' ON CONFLICT (poll_id,nickname) DO NOTHING RETURNING 1`, pollID, nickname, optionID).Scan(&inserted)
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	var status string
	var exists bool
	if err = s.db.QueryRow(ctx, `SELECT status,EXISTS(SELECT 1 FROM poll_votes WHERE poll_id=$1 AND nickname=$2) FROM polls WHERE id=$1`, pollID, nickname).Scan(&status, &exists); errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	if err != nil {
		return err
	}
	if exists {
		return domain.ErrVoted
	}
	if status == "closed" {
		return domain.ErrClosed
	}
	return domain.ErrInvalid
}
func (s Store) Close(ctx context.Context, pollID int64) error {
	var id int64
	err := s.db.QueryRow(ctx, `UPDATE polls SET status='closed',closed_at=NOW() AT TIME ZONE 'UTC' WHERE id=$1 AND status='open' RETURNING id`, pollID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		var n int
		if e := s.db.QueryRow(ctx, `SELECT count(*) FROM polls WHERE id=$1`, pollID).Scan(&n); e != nil {
			return e
		}
		if n == 0 {
			return domain.ErrNotFound
		}
		return domain.ErrClosed
	}
	return err
}
