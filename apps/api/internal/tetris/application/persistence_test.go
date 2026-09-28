package application

import (
	"chat/api/internal/tetris/domain"
	"context"
	"errors"
	"testing"
	"time"
)

type unreliableResults struct {
	memoryResults
	fail bool
}

func (r *unreliableResults) Save(ctx context.Context, result Result) error {
	if r.fail {
		return errors.New("database unavailable")
	}
	return r.memoryResults.Save(ctx, result)
}

type unreliableInvites struct {
	memoryInvites
	fail bool
}

func (i *unreliableInvites) Publish(ctx context.Context, invite Invitation) error {
	if i.fail {
		return errors.New("invitation unavailable")
	}
	return i.memoryInvites.Publish(ctx, invite)
}

func TestPersistenceRetriesWithoutLosingFinishedResult(t *testing.T) {
	ctx := context.Background()
	results, invites := &unreliableResults{}, &unreliableInvites{}
	s := NewService(results, invites)
	a := domain.Actor{Key: "host", Room: "room", UserID: 1}
	m, err := s.Create(ctx, a, false)
	if err != nil {
		t.Fatal(err)
	}
	e := s.games[m.ID]
	e.match.Status = "finished"
	e.match.FinishedAt = time.Now()
	e.match.Players[0].Board.Score = 800
	e.invitationDirty = true
	results.fail, invites.fail = true, true
	s.flush(ctx)
	if e.saved || !e.invitationDirty || len(results.saved) != 0 {
		t.Fatal("failed writes must remain pending")
	}
	results.fail, invites.fail = false, false
	s.flush(ctx)
	if !e.saved || e.invitationDirty || len(results.saved) != 1 {
		t.Fatal("retry did not save pending work")
	}
	if results.saved[0].Players[0].Score != 800 || invites.sent[len(invites.sent)-1].Status != "finished" {
		t.Fatal("retry lost the final score or invitation status")
	}
	s.flush(ctx)
	if len(results.saved) != 1 {
		t.Fatal("a saved result was submitted again")
	}
}

func TestCreationFailureAndAccessBoundaries(t *testing.T) {
	ctx := context.Background()
	invites := &unreliableInvites{fail: true}
	s := NewService(&memoryResults{}, invites)
	a := domain.Actor{Key: "host", Room: "room"}
	if _, err := s.Create(ctx, a, false); err == nil || len(s.games) != 0 {
		t.Fatal("failed invitation must not leave an invisible active match")
	}
	invites.fail = false
	m, err := s.Create(ctx, a, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Rematch(ctx, a, "missing"); err != domain.ErrNotFound {
		t.Fatal(err)
	}
	if _, err := s.Rematch(ctx, domain.Actor{Key: "observer", Room: "room"}, m.ID); err != domain.ErrForbidden {
		t.Fatal(err)
	}
	if _, err := s.Rematch(ctx, a, m.ID); err != domain.ErrInvalid {
		t.Fatal(err)
	}
	if err := s.Command(a, "missing", "join", 0); err != domain.ErrNotFound {
		t.Fatal(err)
	}
	if err := s.Command(domain.Actor{Key: "other", Room: "elsewhere"}, m.ID, "join", 0); err != domain.ErrForbidden {
		t.Fatal(err)
	}
	if _, err := s.Leaders(ctx, "invalid", "all"); err != domain.ErrInvalid {
		t.Fatal(err)
	}
	if _, err := s.Leaders(ctx, "solo", "invalid"); err != domain.ErrInvalid {
		t.Fatal(err)
	}
	if err := s.Command(a, m.ID, "leave", 0); err != nil {
		t.Fatal(err)
	}
	s.flush(ctx)
	if !s.games[m.ID].saved {
		t.Fatal("cancelled lobby should not wait for a ranked result")
	}
	if _, err := s.Create(ctx, a, false); err != domain.ErrLimit {
		t.Fatal("cancelled lobbies must obey the creation cooldown")
	}
}
