package postgres_test

import (
	"chat/api/internal/accounts/adapters/postgres"
	"chat/api/internal/accounts/application"
	"context"
	"errors"
	"github.com/jackc/pgx/v5/pgxpool"
	"sync"
	"testing"
)

func testPrivateSettings(t *testing.T, pool *pgxpool.Pool, store postgres.Accounts) {
	ctx := context.Background()
	first, err := store.Create(ctx, "settings-one", "", "unchanged-hash", "192.0.2.101")
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Create(ctx, "settings-two", "", "second-hash", "192.0.2.102")
	if err != nil {
		t.Fatal(err)
	}
	service := application.NewSettings(store)
	email, err := service.Read(ctx, first.UserID)
	if err != nil || email != nil {
		t.Fatal("empty email", email, err)
	}
	testConcurrentEmail(t, service, first.UserID, second.UserID)
	if _, err = service.Save(ctx, first.UserID, "first@example.test"); err != nil {
		t.Fatal(err)
	}
	if _, err = service.Save(ctx, second.UserID, "second@example.test"); err != nil {
		t.Fatal(err)
	}
	if _, err = service.Save(ctx, second.UserID, "FIRST@EXAMPLE.TEST"); !errors.Is(err, application.ErrEmailTaken) {
		t.Fatal(err)
	}
	email, err = service.Read(ctx, second.UserID)
	if err != nil || email == nil || *email != "second@example.test" {
		t.Fatal("conflict changed stored email")
	}
	_, hash, err := store.FindByNickname(ctx, first.Nickname)
	if err != nil || hash != "unchanged-hash" {
		t.Fatal("settings changed credentials")
	}
	if _, err = service.Save(ctx, first.UserID, " first@example.test "); err != nil {
		t.Fatal("idempotent save", err)
	}
	testSettingsIneligibleActor(t, pool, service, second.UserID)
}

func testConcurrentEmail(t *testing.T, service application.Settings, firstID, secondID int64) {
	t.Helper()
	ctx := context.Background()
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, id := range []int64{firstID, secondID} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, saveErr := service.Save(ctx, id, " Same@Example.Test ")
			results <- saveErr
		}()
	}
	wg.Wait()
	close(results)
	succeeded, conflicted := 0, 0
	for result := range results {
		if result == nil {
			succeeded++
		} else if errors.Is(result, application.ErrEmailTaken) {
			conflicted++
		} else {
			t.Fatal(result)
		}
	}
	if succeeded != 1 || conflicted != 1 {
		t.Fatalf("race: %d/%d", succeeded, conflicted)
	}
}

func testSettingsIneligibleActor(t *testing.T, pool *pgxpool.Pool, service application.Settings, id int64) {
	t.Helper()
	ctx := context.Background()
	if _, err := service.Save(ctx, 999999999, "x@y.z"); !errors.Is(err, application.ErrAccountNotFound) {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE registered_users SET is_game_guest=true WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Read(ctx, id); !errors.Is(err, application.ErrAccountNotFound) {
		t.Fatal("game guest email")
	}
	if _, err := service.Save(ctx, id, "x@y.z"); !errors.Is(err, application.ErrAccountNotFound) {
		t.Fatal("game guest write")
	}
}
