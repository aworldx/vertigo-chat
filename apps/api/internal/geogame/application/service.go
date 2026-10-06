package application

import (
	"chat/api/internal/geogame/domain"
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"
)

type Store interface {
	Update(context.Context, string, func(*domain.Game) error) error
}
type Questions interface {
	Prepare(context.Context) ([]domain.Question, error)
	Configured() bool
}
type Service struct {
	Store     Store
	Questions Questions
	Now       func() time.Time
}

func (s Service) View(ctx context.Context, a domain.Actor) (domain.Game, error) {
	var result domain.Game
	err := s.Store.Update(ctx, a.Room, func(g *domain.Game) error { g.Advance(s.Now()); result = *g; return nil })
	return result, err
}

func (s Service) Start(ctx context.Context, a domain.Actor) (domain.Game, error) {
	if !s.Questions.Configured() {
		return domain.Game{}, domain.ErrUnavailable
	}
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return domain.Game{}, err
	}
	id := hex.EncodeToString(bytes[:])
	err := s.Store.Update(ctx, a.Room, func(g *domain.Game) error {
		now := s.Now()
		g.Advance(now)
		if g.Phase == "active" || g.Phase == "reveal" || g.Phase == "preparing" {
			return domain.ErrConflict
		}
		if now.Before(g.Cooldown) {
			return domain.ErrLimit
		}
		awards := g.Awards
		*g = domain.New(id, now)
		g.Awards = awards
		return nil
	})
	if err != nil {
		return domain.Game{}, err
	}
	prepareCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	questions, prepareErr := s.Questions.Prepare(prepareCtx)
	// Release a reservation even if the requesting browser disconnected.
	finishCtx, finishCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer finishCancel()
	var result domain.Game
	err = s.Store.Update(finishCtx, a.Room, func(g *domain.Game) error {
		if g.ID != id || g.Phase != "preparing" {
			return domain.ErrConflict
		}
		if prepareErr == nil {
			prepareErr = g.Ready(questions, s.Now())
		}
		if prepareErr != nil {
			g.Phase = "unavailable"
			g.Questions = nil
		}
		result = *g
		return nil
	})
	if err != nil {
		return domain.Game{}, err
	}
	if prepareErr != nil {
		return result, domain.ErrUnavailable
	}
	return result, nil
}

func (s Service) Answer(ctx context.Context, a domain.Actor, id string, round int, text string) (domain.Game, error) {
	var result domain.Game
	err := s.Store.Update(ctx, a.Room, func(g *domain.Game) error {
		now := s.Now()
		g.Advance(now)
		if err := g.Answer(a, id, round, text, now); err != nil {
			return err
		}
		result = *g
		return nil
	})
	return result, err
}
