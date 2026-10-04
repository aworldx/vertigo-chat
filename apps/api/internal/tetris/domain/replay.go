package domain

import "time"

// ReplayInput contains player decisions, never cells, scores or random state.
type ReplayInput struct {
	Type     string `json:"type"`
	Sequence int64  `json:"sequence"`
	PieceID  int64  `json:"piece_id"`
	At       int64  `json:"at_ms"`
}

// Replay is applied to an isolated candidate by the application service. Bounded
// batches can catch up after a disconnect without trusting a client score or clock.
func (m *Match) Replay(key string, through int64, inputs []ReplayInput, now time.Time) error {
	if err := m.replayAllowed(key, through, len(inputs), now); err != nil {
		return err
	}
	p := m.Player(key)
	for _, input := range inputs {
		if input.Sequence <= p.Sequence {
			continue
		}
		if err := m.replayInput(p, input, through, now); err != nil {
			return err
		}
	}
	if through > m.Elapsed {
		if err := m.replayUntil(through, now); err != nil {
			return err
		}
	}
	p.LastSeen = now
	return nil
}
func (m *Match) replayUntil(target int64, now time.Time) error {
	for m.Elapsed < target {
		if m.Paused || m.Status != "running" {
			return ErrInvalid
		}
		m.Players[0].LastSeen = now
		m.advance(50, now)
	}
	return nil
}

func (m *Match) replayAllowed(key string, through int64, count int, now time.Time) error {
	if !m.ClientClock || m.Mode != "solo" || m.Host != key || count > 128 {
		return ErrForbidden
	}
	p := m.Player(key)
	if p == nil || through < 0 || through%50 != 0 || through > now.Sub(m.StartedAt).Milliseconds()+1000 || through > m.Elapsed+10000 {
		return ErrInvalid
	}
	return nil
}
func (m *Match) replayInput(p *Player, input ReplayInput, through int64, now time.Time) error {
	if m.Status != "running" || input.Sequence != p.Sequence+1 || input.At < m.Elapsed || input.At > through || input.At%50 != 0 {
		return ErrInvalid
	}
	switch input.Type {
	case "left", "right", "down", "rotate", "counterrotate", "drop", "hold", "pause":
	default:
		return ErrInvalid
	}
	if err := m.replayUntil(input.At, now); err != nil {
		return err
	}
	if p.Board.Dead || input.PieceID != p.Board.PieceID {
		return ErrInvalid
	}
	if err := m.InputForPiece(p.Actor.Key, input.Type, input.Sequence, input.PieceID, now); err != nil {
		return err
	}
	return nil
}
