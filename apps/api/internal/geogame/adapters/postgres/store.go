package postgres

import (
	"bytes"
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type Store struct{ Pool *pgxpool.Pool }

func (s Store) Update(ctx context.Context, room string, fn func(*domain.Game) error) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, `INSERT INTO geo_room_games(room_id,state) VALUES($1,'{}') ON CONFLICT DO NOTHING`, room); err != nil {
		return err
	}
	var data []byte
	if err = tx.QueryRow(ctx, `SELECT state FROM geo_room_games WHERE room_id=$1 FOR UPDATE`, room).Scan(&data); err != nil {
		return err
	}
	var game domain.Game
	if err = json.Unmarshal(data, &game); err != nil {
		return err
	}
	before, err := json.Marshal(game)
	if err != nil {
		return err
	}
	if err = fn(&game); err != nil {
		return err
	}
	for _, award := range game.Awards {
		if _, err = tx.Exec(ctx, `INSERT INTO geo_ranked_rounds(game_id,round,identity_key,nickname,points) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, award.GameID, award.Round, award.Identity, award.Nickname, award.Points); err != nil {
			return err
		}
	}
	game.Awards = nil
	after, err := json.Marshal(game)
	if err != nil {
		return err
	}
	if !bytes.Equal(before, after) {
		if _, err = tx.Exec(ctx, `UPDATE geo_room_games SET state=$2,updated_at=now() WHERE room_id=$1`, room, after); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Drop dormant game data independently of whether anyone polls the room again.
func (s Store) Prune(ctx context.Context) error {
	rows, err := s.Pool.Query(ctx, `SELECT room_id FROM geo_room_games WHERE state->>'phase' IN ('active','reveal')`)
	if err != nil {
		return err
	}
	var rooms []string
	for rows.Next() {
		var room string
		if err := rows.Scan(&room); err != nil {
			rows.Close()
			return err
		}
		rooms = append(rooms, room)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	for _, room := range rooms {
		if err := s.Update(ctx, room, func(g *domain.Game) error { g.Advance(time.Now()); return nil }); err != nil {
			return err
		}
	}
	_, err = s.Pool.Exec(ctx, `DELETE FROM geo_room_games WHERE updated_at < now() - interval '2 hours'`)
	return err
}

func (s Store) Leaders(ctx context.Context) ([]domain.Ranking, error) {
	rows, err := s.Pool.Query(ctx, `SELECT (array_agg(nickname ORDER BY awarded_at DESC,game_id DESC,round DESC))[1],sum(points),count(*) FROM geo_ranked_rounds GROUP BY identity_key ORDER BY sum(points) DESC,count(*) ASC,identity_key ASC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []domain.Ranking{}
	for rows.Next() {
		var row domain.Ranking
		if err := rows.Scan(&row.Nickname, &row.Points, &row.Rounds); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}
