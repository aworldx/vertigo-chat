package application

import (
	"context"
	"testing"
	"time"

	"chat/api/internal/chatsessions/domain"
)

type lifecycleStoreStub struct {
	deadline     time.Time
	activeCutoff time.Time
	hiddenCutoff time.Time
	ended        bool
}

func (s *lifecycleStoreStub) Create(context.Context, domain.Session, string) (domain.Session, error) {
	return domain.Session{}, nil
}

func (s *lifecycleStoreStub) Start(_ context.Context, session domain.Session, _ string, _ *int64) (domain.Session, error) {
	session.VisitID = 1
	session.Status = domain.StatusActive
	return session, nil
}

func (s *lifecycleStoreStub) Restore(_ context.Context, _ string, _ string, _ string, _ time.Time, activeCutoff time.Time, hiddenCutoff time.Time) (domain.Session, error) {
	s.activeCutoff = activeCutoff
	s.hiddenCutoff = hiddenCutoff
	return domain.Session{}, nil
}

func (s *lifecycleStoreStub) Reconnect(_ context.Context, _ string, _ string, _ int, now time.Time, grace time.Duration, _ time.Duration) (domain.Session, error) {
	s.deadline = now.Add(grace)
	return domain.Session{Status: domain.StatusReconnecting, ReconnectDeadline: &s.deadline}, nil
}

func (s *lifecycleStoreStub) Activate(context.Context, string, string, int, time.Time, time.Time, time.Time) (domain.Session, error) {
	return domain.Session{Status: domain.StatusActive}, nil
}

func (s *lifecycleStoreStub) Touch(context.Context, string, string, int, string, time.Time, time.Time, time.Time) error {
	return nil
}

func (s *lifecycleStoreStub) MarkStale(context.Context, time.Time, time.Duration, time.Duration, time.Duration) ([]domain.Session, error) {
	return nil, nil
}

func (s *lifecycleStoreStub) Expired(context.Context, time.Time) ([]domain.Session, error) {
	return nil, nil
}

func (s *lifecycleStoreStub) RegisterIdentity(context.Context, string, string, int, int64, string, time.Time) (domain.Session, error) {
	return domain.Session{Status: domain.StatusActive}, nil
}

func (s *lifecycleStoreStub) End(context.Context, string, string, int, time.Time) (domain.Session, error) {
	s.ended = true
	return domain.Session{Status: domain.StatusEnded}, nil
}

func TestReconnectDelegatesServerComputedDeadlineAndEndRemainsTerminal(t *testing.T) {
	store := &lifecycleStoreStub{}
	service := NewService(store)
	now := time.Date(2026, time.September, 22, 12, 0, 0, 0, time.UTC)

	if _, err := service.Reconnect(context.Background(), "session", "guest:1", 3, now); err != nil {
		t.Fatalf("Reconnect() error = %v", err)
	}
	if want := now.Add(60 * time.Second); !store.deadline.Equal(want) {
		t.Fatalf("deadline = %s, want %s", store.deadline, want)
	}
	if _, err := service.End(context.Background(), "session", "guest:1", 3, now); err != nil {
		t.Fatalf("End() error = %v", err)
	}
	if !store.ended {
		t.Fatal("End() did not delegate to store")
	}
}

func TestRestoreUsesTheSameVisibleAndHiddenHeartbeatWindows(t *testing.T) {
	store := &lifecycleStoreStub{}
	service := NewService(store)
	now := time.Date(2026, time.September, 22, 12, 0, 0, 0, time.UTC)

	if _, err := service.Restore(context.Background(), "session", "guest:1", "secret", now); err != nil {
		t.Fatalf("Restore() error = %v", err)
	}
	if want := now.Add(-4 * time.Minute); !store.activeCutoff.Equal(want) {
		t.Fatalf("active cutoff = %s, want %s", store.activeCutoff, want)
	}
	if want := now.Add(-8 * time.Minute); !store.hiddenCutoff.Equal(want) {
		t.Fatalf("hidden cutoff = %s, want %s", store.hiddenCutoff, want)
	}
}

func TestPolicyKeepsConfiguredGraceWindows(t *testing.T) {
	store := &lifecycleStoreStub{}
	service := NewService(store, Policy{HeartbeatTimeout: 30 * time.Second, Grace: 10 * time.Second, HiddenGrace: time.Minute})
	now := time.Date(2026, time.September, 22, 12, 0, 0, 0, time.UTC)

	if _, err := service.Restore(context.Background(), "session", "guest:1", "secret", now); err != nil {
		t.Fatalf("Restore() error = %v", err)
	}
	if want := now.Add(-40 * time.Second); !store.activeCutoff.Equal(want) {
		t.Fatalf("active cutoff = %s, want %s", store.activeCutoff, want)
	}
	if want := now.Add(-90 * time.Second); !store.hiddenCutoff.Equal(want) {
		t.Fatalf("hidden cutoff = %s, want %s", store.hiddenCutoff, want)
	}
}
