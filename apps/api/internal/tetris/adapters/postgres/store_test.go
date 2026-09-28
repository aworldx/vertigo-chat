package postgres

import (
	"chat/api/internal/tetris/application"
	"chat/api/migrations"
	"context"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"testing"
	"time"
)

func TestRankingsPostgres(t *testing.T) {
	url := os.Getenv("GO_TETRIS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("requires disposable tetris database")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := migrations.Apply(ctx, pool); err != nil {
		t.Fatal(err)
	}
	store := NewStore(pool)
	now := time.Now().UTC()
	saveRankingRounds(t, store, ctx, now)
	rows, err := store.Leaders(ctx, "versus", "all")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || rows[0].Matches != 3 || rows[1].Matches != 3 || rows[0].Rating <= 1000 || rows[0].Rating+rows[1].Rating != 2000 {
		t.Fatalf("rankings %+v", rows)
	}
	month, err := store.Leaders(ctx, "versus", "month")
	if err != nil || len(month) != 2 || month[0].Rating != rows[0].Rating {
		t.Fatalf("month: %+v %v", month, err)
	}
	verifyGuestAndSolo(t, store, ctx, now)
}
func verifyGuestAndSolo(t *testing.T, store Store, ctx context.Context, now time.Time) {
	t.Helper()
	guest := application.Result{ID: "guest-match", Mode: "versus", FinishedAt: now, Players: []application.ResultPlayer{{UserID: 9001, Nickname: "Первый", Level: 1, Place: 1}, {Nickname: "Гость", Level: 1, Place: 2}}}
	if err := store.Save(ctx, guest); err != nil {
		t.Fatal(err)
	}
	after, err := store.Leaders(ctx, "versus", "all")
	if err != nil || after[0].Matches != 3 {
		t.Fatal("guest affected rating")
	}
	for i, score := range []int{1000, 500, 2500} {
		r := application.Result{ID: fmt.Sprintf("solo-%d", i), Mode: "solo", FinishedAt: now, Players: []application.ResultPlayer{{UserID: 9001, Nickname: "Первый", Score: score, Level: 2, Lines: 12, Place: 1}}}
		if err := store.Save(ctx, r); err != nil {
			t.Fatal(err)
		}
	}
	solo, err := store.Leaders(ctx, "solo", "all")
	if err != nil || len(solo) != 1 || solo[0].Score != 2500 {
		t.Fatalf("solo %+v %v", solo, err)
	}
}

func saveRankingRounds(t *testing.T, store Store, ctx context.Context, now time.Time) {
	t.Helper()
	for i := 0; i < 4; i++ {
		r := application.Result{ID: fmt.Sprintf("ranking-%d", i), Mode: "versus", FinishedAt: now, Players: []application.ResultPlayer{{UserID: 9001, Nickname: "Первый", Level: 1, Place: 1}, {UserID: 9002, Nickname: "Второй", Level: 1, Place: 2}}}
		if err := store.Save(ctx, r); err != nil {
			t.Fatal(err)
		}
		if err := store.Save(ctx, r); err != nil {
			t.Fatal(err)
		}
	}
}
