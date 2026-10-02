package application

import (
	"chat/api/internal/polls/domain"
	"context"
	"testing"
)

type testStore struct{ created domain.Input }

func (s *testStore) Create(_ context.Context, _ int64, input domain.Input) (domain.Poll, error) {
	s.created = input
	return domain.Poll{ID: 1}, nil
}
func (*testStore) List(context.Context, string) ([]domain.Poll, error) { return nil, nil }
func (*testStore) Vote(context.Context, int64, string, int64) error    { return nil }
func (*testStore) Close(context.Context, int64) error                  { return nil }

func TestCreateNormalizesAndRejectsInvalidPoll(t *testing.T) {
	store := &testStore{}
	s := NewService(store)
	if _, err := s.Create(context.Background(), 7, domain.Input{Question: "  Вопрос ", Options: []string{" Первый ", "Второй"}}); err != nil {
		t.Fatal(err)
	}
	if store.created.Question != "Вопрос" || store.created.Options[0] != "Первый" {
		t.Fatalf("store got %#v", store.created)
	}
	if _, err := s.Create(context.Background(), 7, domain.Input{Question: "", Options: []string{"a", "b"}}); err != domain.ErrInvalid {
		t.Fatalf("invalid create: %v", err)
	}
	if err := s.Vote(context.Background(), 0, "nick", 1); err != domain.ErrInvalid {
		t.Fatalf("invalid vote: %v", err)
	}
	if err := s.Close(context.Background(), 0); err != domain.ErrInvalid {
		t.Fatalf("invalid close: %v", err)
	}
}
