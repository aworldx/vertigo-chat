package http

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"chat/api/internal/chatsessions/application"
	"chat/api/internal/chatsessions/domain"
	rooms "chat/api/internal/rooms/domain"
)

func TestSnapshotQueryBudgetAndViewerIsolation(t *testing.T) {
	sessions := make([]domain.Session, 100)
	for i := range sessions {
		sessions[i] = domain.Session{ID: fmt.Sprint(i), IdentityKey: fmt.Sprint(i), RoomID: "lobby", Generation: 1}
	}
	presenceCalls, historyCalls, presentations, botCalls := 0, 0, 0, 0
	h := NewSocket(application.NewService(storeStub{}), projectionFunc(func(context.Context, string) ([]domain.Session, error) {
		presenceCalls++
		return append([]domain.Session(nil), sessions...), nil
	}), historyFunc(func(context.Context, string) ([]rooms.Message, error) {
		historyCalls++
		return nil, nil
	}), nil, "")
	h.experience.Present = func(_ context.Context, session domain.Session) (Presentation, error) {
		presentations++
		return Presentation{Admin: session.ID == "0"}, nil
	}
	h.experience.BotAvailable = func(context.Context) bool { botCalls++; return true }
	checkConcurrentViewers(t, h, sessions)
	if presenceCalls != 1 || historyCalls != 1 || presentations != 100 || botCalls != 1 {
		t.Fatalf("query budget: presence=%d history=%d presentations=%d bot=%d", presenceCalls, historyCalls, presentations, botCalls)
	}
	h.cache.invalidate()
	if _, err := h.snapshot(t.Context(), sessions[0]); err != nil {
		t.Fatal(err)
	}
	if presenceCalls != 2 {
		t.Fatal("mutation invalidation did not reload")
	}
	h.cache.until = time.Time{}
	if _, err := h.snapshot(t.Context(), sessions[0]); err != nil {
		t.Fatal(err)
	}
	if presenceCalls != 3 {
		t.Fatal("expiry did not reload")
	}
	sessions[0].Generation++
	if _, err := h.snapshot(t.Context(), sessions[0]); err != nil {
		t.Fatal(err)
	}
	// A newly joined session must not be rejected by an older cached projection.
	joined := domain.Session{ID: "new", RoomID: "lobby", Generation: 1}
	sessions = append(sessions, joined)
	if _, err := h.snapshot(t.Context(), joined); err != nil {
		t.Fatal(err)
	}
	if presenceCalls != 5 {
		t.Fatal("new viewer did not refresh projection")
	}
	stale := joined
	stale.Generation = 0
	if _, err := h.snapshot(t.Context(), stale); !errors.Is(err, domain.ErrInvalidSession) {
		t.Fatal("stale generation accepted", err)
	}
}

func TestSnapshotDoesNotCacheFailures(t *testing.T) {
	calls := 0
	h := NewSocket(application.NewService(storeStub{}), projectionFunc(func(context.Context, string) ([]domain.Session, error) {
		calls++
		return nil, errors.New("unavailable")
	}), nil, nil, "")
	for range 2 {
		if _, err := h.snapshot(t.Context(), domain.Session{}); err == nil {
			t.Fatal("ignored failure")
		}
	}
	if calls != 2 {
		t.Fatal("cached database failure")
	}
}

func checkConcurrentViewers(t *testing.T, h Socket, sessions []domain.Session) {
	t.Helper()
	var workers sync.WaitGroup
	for _, session := range sessions {
		workers.Go(func() {
			view, err := h.snapshot(t.Context(), session)
			if err != nil {
				t.Error(err)
				return
			}
			if view.Admin != (session.ID == "0") {
				t.Error("admin projection leaked between viewers")
			}
			self := 0
			for _, peer := range view.Peers {
				if peer.Self {
					self++
					if peer.ID != session.ID {
						t.Error("wrong self")
					}
				}
			}
			if self != 1 {
				t.Error("wrong self count")
			}
		})
	}
	workers.Wait()
}
