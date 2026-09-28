package postgres

import (
	"chat/api/internal/tetris/application"
	"chat/api/internal/tetris/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Store struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) Store { return Store{pool} }
func (s Store) Save(ctx context.Context, r application.Result) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(674923007)`); err != nil {
			return err
		}
		tag, err := tx.Exec(ctx, `INSERT INTO tetris_results(id,mode,finished_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, r.ID, r.Mode, r.FinishedAt)
		if err != nil || tag.RowsAffected() == 0 {
			return err
		}
		rated := r.Mode == "versus" && len(r.Players) >= 2
		for i, p := range r.Players {
			if p.UserID == 0 {
				rated = false
			}
			if _, err := tx.Exec(ctx, `INSERT INTO tetris_scores(game_id,slot,user_id,nickname,score,lines,level,place) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, r.ID, i, p.UserID, p.Nickname, p.Score, p.Lines, p.Level, p.Place); err != nil {
				return err
			}
		}
		if !rated {
			return nil
		}
		for _, period := range []string{"all", r.FinishedAt.UTC().Format("2006-01")} {
			if err := rate(ctx, tx, r, period); err != nil {
				return err
			}
		}
		return nil
	})
}
func rate(ctx context.Context, tx pgx.Tx, r application.Result, period string) error {
	ratings := make([]float64, len(r.Players))
	for i, p := range r.Players {
		if _, err := tx.Exec(ctx, `INSERT INTO tetris_ratings(period,user_id,nickname,updated_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, period, p.UserID, p.Nickname, r.FinishedAt); err != nil {
			return err
		}
		if err := tx.QueryRow(ctx, `SELECT rating FROM tetris_ratings WHERE period=$1 AND user_id=$2`, period, p.UserID).Scan(&ratings[i]); err != nil {
			return err
		}
	}
	for i, p := range r.Players {
		others, places := []float64{}, []int{}
		for j, o := range r.Players {
			if i == j {
				continue
			}
			var count int
			err := tx.QueryRow(ctx, `SELECT count(*) FROM tetris_results r JOIN tetris_scores a ON a.game_id=r.id AND a.user_id=$1 JOIN tetris_scores b ON b.game_id=r.id AND b.user_id=$2 WHERE r.mode='versus' AND r.finished_at>=date_trunc('day',$3::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND r.finished_at<(date_trunc('day',$3::timestamptz AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'UTC'`, p.UserID, o.UserID, r.FinishedAt).Scan(&count)
			if err != nil {
				return err
			}
			if count <= 3 {
				others = append(others, ratings[j])
				places = append(places, o.Place)
			}
		}
		if len(others) == 0 {
			continue
		}
		delta := domain.RatingChange(ratings[i], p.Place, others, places) * float64(len(others)) / float64(len(r.Players)-1)
		wins := 0
		if p.Place == 1 {
			wins = 1
			for j, o := range r.Players {
				if j != i && o.Place == 1 {
					wins = 0
				}
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE tetris_ratings SET rating=rating+$3,matches=matches+1,wins=wins+$4,nickname=$5,updated_at=$6 WHERE period=$1 AND user_id=$2`, period, p.UserID, delta, wins, p.Nickname, r.FinishedAt); err != nil {
			return err
		}
	}
	return nil
}
func (s Store) Leaders(ctx context.Context, mode, period string) ([]application.Leader, error) {
	if mode == "solo" {
		return s.solo(ctx, period)
	}
	if period == "month" {
		period = time.Now().UTC().Format("2006-01")
	}
	rows, err := s.pool.Query(ctx, `SELECT nickname,rating,matches,wins,updated_at FROM tetris_ratings WHERE period=$1 AND matches>0 ORDER BY rating DESC,matches DESC,user_id LIMIT 100`, period)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.Leader{}
	for rows.Next() {
		var row application.Leader
		if err := rows.Scan(&row.Nickname, &row.Rating, &row.Matches, &row.Wins, &row.AchievedAt); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
func (s Store) solo(ctx context.Context, period string) ([]application.Leader, error) {
	rows, err := s.pool.Query(ctx, `SELECT nickname,score,lines,level,finished_at FROM (SELECT DISTINCT ON(s.user_id) s.user_id,s.nickname,s.score,s.lines,s.level,r.finished_at FROM tetris_scores s JOIN tetris_results r ON r.id=s.game_id WHERE r.mode='solo' AND s.user_id>0 AND ($1='all' OR r.finished_at>=date_trunc('month',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') ORDER BY s.user_id,s.score DESC,r.finished_at) best ORDER BY score DESC,finished_at,user_id LIMIT 100`, period)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []application.Leader{}
	for rows.Next() {
		var row application.Leader
		if err := rows.Scan(&row.Nickname, &row.Score, &row.Lines, &row.Level, &row.AchievedAt); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
