package postgres

import (
	"chat/api/internal/polls/domain"
	"chat/api/migrations"
	"context"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPollStorePostgresConcurrentVote(t *testing.T) {
	url := os.Getenv("GO_POLLS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set GO_POLLS_TEST_DATABASE_URL to an isolated disposable database")
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
	var userID int64
	if err := pool.QueryRow(ctx, `INSERT INTO registered_users(nickname,password_hash,is_admin,is_game_guest,theme_id,public_message_count,inserted_at,updated_at) VALUES('poll-test-admin','hash',true,false,1,0,NOW(),NOW()) ON CONFLICT (nickname) DO UPDATE SET is_admin=true RETURNING id`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	store := NewStore(pool)
	poll, err := store.Create(ctx, userID, domain.Input{Question: "Проверка", Options: []string{"Да", "Нет"}})
	if err != nil {
		t.Fatal(err)
	}
	listed, err := store.List(ctx, "guest")
	if err != nil {
		t.Fatalf("list: %#v, %v", listed, err)
	}
	var optionID int64
	for _, value := range listed {
		if value.ID == poll.ID && len(value.Options) == 2 {
			optionID = value.Options[0].ID
		}
	}
	if optionID == 0 {
		t.Fatalf("created poll not listed: %#v", listed)
	}
	assertPollSelections(t, store, ctx, poll.ID, listed)
	assertConcurrentVote(t, store, ctx, poll.ID, optionID)
	if err := store.Close(ctx, poll.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.Vote(ctx, poll.ID, "other", optionID); err != domain.ErrClosed {
		t.Fatalf("closed vote: %v", err)
	}
}

func assertConcurrentVote(t *testing.T, store Store, ctx context.Context, pollID, optionID int64) {
	t.Helper()
	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- store.Vote(ctx, pollID, "same-nickname", optionID)
		}()
	}
	wg.Wait()
	close(errs)
	var succeeded, duplicated int
	for err := range errs {
		switch err {
		case nil:
			succeeded++
		case domain.ErrVoted:
			duplicated++
		default:
			t.Fatal(err)
		}
	}
	if succeeded != 1 || duplicated != 1 {
		t.Fatalf("concurrent votes: success=%d duplicate=%d", succeeded, duplicated)
	}
}

func assertPollSelections(t *testing.T, store Store, ctx context.Context, pollID int64, listed []domain.Poll) {
	t.Helper()
	// Every option must restore the voter's selection, including non-first rows.
	for _, value := range listed {
		if value.ID != pollID {
			continue
		}
		for _, option := range value.Options {
			nickname := "voter-" + option.Body
			if err := store.Vote(ctx, pollID, nickname, option.ID); err != nil {
				t.Fatal(err)
			}
			results, err := store.List(ctx, nickname)
			if err != nil {
				t.Fatal(err)
			}
			for _, result := range results {
				if result.ID == pollID && result.SelectedOptionID != option.ID {
					t.Fatalf("selection for %q: got %d, want %d", nickname, result.SelectedOptionID, option.ID)
				}
			}
		}
	}
}
