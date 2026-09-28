package application

import (
	"chat/api/internal/tetris/domain"
	"context"
	"sync"
	"testing"
)

type memoryResults struct{ saved []Result }

func (m *memoryResults) Save(_ context.Context, r Result) error {
	m.saved = append(m.saved, r)
	return nil
}
func (*memoryResults) Leaders(context.Context, string, string) ([]Leader, error) {
	return []Leader{}, nil
}

type memoryInvites struct{ sent []Invitation }

func (m *memoryInvites) Publish(_ context.Context, i Invitation) error {
	m.sent = append(m.sent, i)
	return nil
}
func TestConcurrentSeatsPrivacyAndCopy(t *testing.T) {
	store, invites := &memoryResults{}, &memoryInvites{}
	s := NewService(store, invites)
	ctx := context.Background()
	a := domain.Actor{Key: "a", Room: "r", Nickname: "A"}
	m, err := s.Create(ctx, a, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(invites.sent) != 1 {
		t.Fatal("no invitation")
	}
	var wg sync.WaitGroup
	for _, key := range []string{"b", "c", "d", "e"} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = s.Command(domain.Actor{Key: key, Room: "r", Nickname: key}, m.ID, "join", 0)
		}()
	}
	wg.Wait()
	m, err = s.View(a, m.ID, false)
	if err != nil || len(m.Players) != 3 {
		t.Fatal("seat cap failed")
	}
	m.Players[0].Board.Next[0] = 99
	again, err := s.View(a, m.Code, false)
	if err != nil || again.Players[0].Board.Next[0] == 99 {
		t.Fatal("state escaped through snapshot")
	}
	if _, err := s.View(domain.Actor{Key: "x", Room: "other"}, m.ID, false); err != domain.ErrForbidden {
		t.Fatal("room access bypass")
	}
	solo, err := s.Create(ctx, domain.Actor{Key: "solo", Room: "r"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(invites.sent) != 1 {
		t.Fatal("solo invitation leaked")
	}
	if _, err := s.View(a, solo.ID, false); err != domain.ErrForbidden {
		t.Fatal("solo visible")
	}
}
