package application

import (
	"chat/api/internal/tetris/domain"
	"time"
)

func (s *Service) ClientClock(a domain.Actor, id string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.find(id)
	if e == nil {
		return domain.ErrNotFound
	}
	if !e.match.Access(a) {
		return domain.ErrForbidden
	}
	if e.match.Mode == "solo" && e.match.Host == a.Key && (e.match.Status == "running" || e.match.Status == "countdown") {
		e.match.ClientClock = enabled
		e.match.Revision++
	}
	return nil
}
func (s *Service) Replay(a domain.Actor, id string, through int64, inputs []domain.ReplayInput) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	e := s.find(id)
	if e == nil {
		return domain.ErrNotFound
	}
	if !e.match.Access(a) {
		return domain.ErrForbidden
	}
	candidate := clone(e.match)
	if err := candidate.Replay(a.Key, through, inputs, time.Now()); err != nil {
		return err
	}
	e.match = candidate
	return nil
}
