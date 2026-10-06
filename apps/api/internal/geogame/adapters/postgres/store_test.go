package postgres

import (
	"chat/api/internal/geogame/domain"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"testing"
	"time"
)

func TestPostgresConcurrentAnswersAndRollback(t *testing.T) {
	url := os.Getenv("GO_GEO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("disposable PostgreSQL required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := Store{Pool: pool}
	room := fmt.Sprintf("geo-test-%d", time.Now().UnixNano())
	defer func() { _, _ = pool.Exec(ctx, `DELETE FROM geo_room_games WHERE room_id=$1`, room) }()
	now := time.Now()
	g := domain.New("id", now)
	qs := make([]domain.Question, 5)
	for i := range qs {
		qs[i] = domain.Question{ID: fmt.Sprint(i), PanoID: fmt.Sprint(i), Place: domain.Place{Countries: []string{"Italy"}}}
	}
	if err := g.Ready(qs, now); err != nil {
		t.Fatal(err)
	}
	if err := s.Update(ctx, room, func(current *domain.Game) error { *current = g; return nil }); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := range 16 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			err := s.Update(ctx, room, func(g *domain.Game) error {
				return g.Answer(domain.Actor{Key: fmt.Sprint(i), Nickname: fmt.Sprint(i)}, "id", 1, "Italy", now)
			})
			if err != nil {
				t.Error(err)
			}
		}(i)
	}
	wg.Wait()
	if err := s.Update(ctx, room, func(g *domain.Game) error {
		if len(g.Answers) != 16 {
			t.Fatalf("lost answers: %d", len(g.Answers))
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if err := s.Update(ctx, room, func(g *domain.Game) error { g.ID = "wrong"; return domain.ErrInvalid }); err != domain.ErrInvalid {
		t.Fatal(err)
	}
	var data []byte
	if err := pool.QueryRow(ctx, `SELECT state FROM geo_room_games WHERE room_id=$1`, room).Scan(&data); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, &g); err != nil || g.ID != "id" {
		t.Fatal("rollback or reload failed")
	}
}

func TestPersistentRegisteredRanking(t *testing.T) {
	url := os.Getenv("GO_GEO_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("disposable PostgreSQL required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := Store{Pool: pool}
	id := fmt.Sprintf("ranking-%d", time.Now().UnixNano())
	room := id
	defer func() {
		_, _ = pool.Exec(ctx, `DELETE FROM geo_room_games WHERE room_id=$1`, room)
		_, _ = pool.Exec(ctx, `DELETE FROM geo_ranked_rounds WHERE game_id=$1`, id)
	}()
	award := domain.Award{GameID: id, Round: 1, Identity: "user:" + id, Nickname: id, Points: 3}
	for range 3 {
		if err := s.Update(ctx, room, func(g *domain.Game) error { g.Awards = []domain.Award{award}; return nil }); err != nil {
			t.Fatal(err)
		}
	}
	_, err = pool.Exec(ctx, `DELETE FROM geo_room_games WHERE room_id=$1`, room)
	if err != nil {
		t.Fatal(err)
	}
	rows, err := s.Leaders(ctx)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range rows {
		if r.Nickname == id {
			found = true
			if r.Points != 3 || r.Rounds != 1 {
				t.Fatalf("duplicate score: %+v", r)
			}
		}
	}
	if !found {
		t.Fatal("ranking lost with game state")
	}
}
