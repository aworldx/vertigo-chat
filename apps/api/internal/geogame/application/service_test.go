package application

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"chat/api/internal/geogame/domain"
)

type memoryStore struct {
	mu   sync.Mutex
	game domain.Game
}

func (s *memoryStore) Update(ctx context.Context, _ string, f func(*domain.Game) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.Marshal(s.game)
	if err != nil {
		return err
	}
	var copy domain.Game
	if err = json.Unmarshal(data, &copy); err != nil {
		return err
	}
	if err = f(&copy); err != nil {
		return err
	}
	s.game = copy
	return nil
}

type questions struct {
	prepare func(context.Context) ([]domain.Question, error)
}

func (q questions) Configured() bool                                       { return true }
func (q questions) Prepare(ctx context.Context) ([]domain.Question, error) { return q.prepare(ctx) }
func validQuestions() []domain.Question {
	result := make([]domain.Question, 5)
	for i := range result {
		id := string(rune('a' + i))
		result[i] = domain.Question{ID: id, PanoID: id, Place: domain.Place{Countries: []string{"Italy"}}}
	}
	return result
}
func TestFailedPreparationCanBeRetriedAfterCooldown(t *testing.T) {
	now := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	store := &memoryStore{}
	attempts := 0
	service := Service{Store: store, Now: func() time.Time { return now }, Questions: questions{prepare: func(context.Context) ([]domain.Question, error) {
		attempts++
		if attempts == 1 {
			return nil, domain.ErrUnavailable
		}
		return validQuestions(), nil
	}}}
	actor := domain.Actor{Key: "a", Room: "lobby"}
	if _, err := service.Start(context.Background(), actor); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatal(err)
	}
	if store.game.Phase != "unavailable" {
		t.Fatal(store.game.Phase)
	}
	if _, err := service.Start(context.Background(), actor); !errors.Is(err, domain.ErrLimit) {
		t.Fatal(err)
	}
	now = now.Add(time.Minute)
	game, err := service.Start(context.Background(), actor)
	if err != nil || game.Phase != "active" || attempts != 2 {
		t.Fatalf("retry: %s %v attempts=%d", game.Phase, err, attempts)
	}
}
func TestConcurrentStartReservesOnePreparation(t *testing.T) {
	store := &memoryStore{}
	entered := make(chan struct{})
	release := make(chan struct{})
	service := Service{Store: store, Now: time.Now, Questions: questions{prepare: func(context.Context) ([]domain.Question, error) {
		close(entered)
		<-release
		return validQuestions(), nil
	}}}
	actor := domain.Actor{Key: "a", Room: "lobby"}
	done := make(chan error, 1)
	go func() { _, err := service.Start(context.Background(), actor); done <- err }()
	<-entered
	_, err := service.Start(context.Background(), domain.Actor{Key: "b", Room: "lobby"})
	close(release)
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatal(err)
	}
	if err = <-done; err != nil {
		t.Fatal(err)
	}
}
func TestDisconnectedStarterReleasesReservation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	store := &memoryStore{}
	service := Service{Store: store, Now: time.Now, Questions: questions{prepare: func(context.Context) ([]domain.Question, error) { cancel(); return nil, context.Canceled }}}
	_, err := service.Start(ctx, domain.Actor{Key: "a", Room: "lobby"})
	if !errors.Is(err, domain.ErrUnavailable) || store.game.Phase != "unavailable" {
		t.Fatalf("reservation not released: %s %v", store.game.Phase, err)
	}
}
