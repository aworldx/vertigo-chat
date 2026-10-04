package domain

import (
	"errors"
	"strconv"
	"time"
)

var ErrInvalid = errors.New("invalid game action")
var ErrForbidden = errors.New("game access denied")
var ErrFull = errors.New("game full or already started")
var ErrNotFound = errors.New("game not found")
var ErrLimit = errors.New("too many games or commands")

type Actor struct {
	Key, Room, Nickname string
	UserID              int64
}
type Pending struct {
	Lines int
	Due   int64
	Hole  int
}
type Player struct {
	Actor        Actor
	ID           string
	Board        Board
	Ready        bool
	Pending      []Pending
	Target       int
	EliminatedAt int64
	LastSeen     time.Time
	Sequence     int64
}
type Match struct {
	ID, Code, Room, Host, Mode, Status string
	Players                            []*Player
	CreatedAt, StartedAt, FinishedAt   time.Time
	Elapsed                            int64
	Paused                             bool
	Seed                               uint32
	Revision                           int64
}

func NewMatch(id, code string, actor Actor, solo bool, seed uint32, now time.Time) *Match {
	m := &Match{ID: id, Code: code, Room: actor.Room, Host: actor.Key, Mode: "versus", Status: "lobby", CreatedAt: now, Seed: seed}
	if solo {
		m.Mode = "solo"
	}
	_ = m.Join(actor, now)
	if solo {
		m.Players[0].Ready = true
		_ = m.Start(actor.Key, now)
	}
	return m
}
func (m *Match) Access(a Actor) bool {
	return a.Room == m.Room && (m.Mode != "solo" || m.Host == a.Key)
}
func (m *Match) Player(key string) *Player {
	for _, p := range m.Players {
		if p.Actor.Key == key {
			return p
		}
	}
	return nil
}
func (m *Match) Join(a Actor, now time.Time) error {
	if !m.Access(a) {
		return ErrForbidden
	}
	if p := m.Player(a.Key); p != nil {
		p.LastSeen = now
		return nil
	}
	if m.Status != "lobby" || len(m.Players) >= 3 {
		return ErrFull
	}
	p := &Player{Actor: a, ID: m.ID + "-" + strconv.FormatInt(m.Revision, 10), LastSeen: now, Board: NewBoard(m.Seed), Pending: []Pending{}}
	m.Players = append(m.Players, p)
	m.Revision++
	return nil
}
func (m *Match) Ready(key string, ready bool) error {
	p := m.Player(key)
	if p == nil || m.Status != "lobby" {
		return ErrInvalid
	}
	p.Ready = ready
	m.Revision++
	return nil
}
func (m *Match) Start(key string, now time.Time) error {
	if key != m.Host {
		return ErrForbidden
	}
	if m.Status != "lobby" || (m.Mode == "versus" && len(m.Players) < 2) {
		return ErrInvalid
	}
	for _, p := range m.Players {
		if !p.Ready {
			return ErrInvalid
		}
	}
	m.Status = "countdown"
	m.StartedAt = now.Add(3 * time.Second)
	m.Revision++
	return nil
}
func (m *Match) Leave(key string, now time.Time) {
	p := m.Player(key)
	if p == nil {
		return
	}
	if m.Status == "countdown" {
		m.Status = "lobby"
		for _, player := range m.Players {
			player.Ready = false
		}
	}
	if m.Status == "lobby" {
		for i, v := range m.Players {
			if v == p {
				m.Players = append(m.Players[:i], m.Players[i+1:]...)
				break
			}
		}
		if len(m.Players) == 0 {
			m.Status = "cancelled"
			m.FinishedAt = now
		} else if m.Host == key {
			m.Host = m.Players[0].Actor.Key
		}
		m.Revision++
		return
	}
	if m.Status == "running" || m.Status == "countdown" {
		p.Board.Dead = true
		p.EliminatedAt = max(1, m.Elapsed)
		m.finish(now)
		m.Revision++
	}
}
func (m *Match) Input(key, action string, seq int64, now time.Time) error {
	return m.InputForPiece(key, action, seq, 0, now)
}

func (m *Match) InputForPiece(key, action string, seq, pieceID int64, now time.Time) error {
	p := m.Player(key)
	if p == nil || p.Board.Dead || m.Status != "running" {
		return ErrInvalid
	}
	if seq <= p.Sequence {
		return nil
	}
	p.Sequence = seq
	p.LastSeen = now
	if action == "pause" && m.Mode == "solo" {
		m.Paused = !m.Paused
		m.Revision++
		return nil
	}
	if m.Paused {
		return nil
	}
	switch action {
	case "left", "right", "down", "rotate", "counterrotate", "drop", "hold":
	default:
		return ErrInvalid
	}
	if pieceID != 0 && pieceID != p.Board.PieceID {
		// Acknowledge, but never apply an old piece's input to its successor.
		m.Revision++
		return nil
	}
	m.outcome(p, p.Board.Apply(action, 0))
	m.finish(now)
	m.Revision++
	return nil
}
func (m *Match) Tick(ms int, now time.Time) {
	if m.Status == "countdown" && !now.Before(m.StartedAt) {
		m.Status = "running"
		m.Revision++
	}
	if m.Status == "lobby" {
		for i := len(m.Players) - 1; i >= 0; i-- {
			p := m.Players[i]
			if now.Sub(p.LastSeen) > 60*time.Second {
				m.Leave(p.Actor.Key, now)
			}
		}
		return
	}
	if m.Status != "running" {
		return
	}
	for _, p := range m.Players {
		if now.Sub(p.LastSeen) > 20*time.Second && !p.Board.Dead {
			p.Board.Dead = true
			p.EliminatedAt = max(1, m.Elapsed)
		}
	}
	if !m.Paused {
		m.Elapsed += int64(ms)
		for _, p := range m.Players {
			if !p.Board.Dead {
				m.outcome(p, p.Board.Apply("tick", ms))
			}
		}
	}
	m.finish(now)
	m.Revision++
}
func (m *Match) outcome(p *Player, o Outcome) {
	if m.Mode == "solo" || !o.Locked {
		return
	}
	attack := o.Attack
	for len(p.Pending) > 0 && attack > 0 {
		n := min(attack, p.Pending[0].Lines)
		p.Pending[0].Lines -= n
		attack -= n
		if p.Pending[0].Lines == 0 {
			p.Pending = p.Pending[1:]
		}
	}
	if attack > 0 {
		m.attack(p, attack)
	}
	for len(p.Pending) > 0 && p.Pending[0].Due <= m.Elapsed {
		pending := p.Pending[0]
		p.Pending = p.Pending[1:]
		p.Board.Garbage(pending.Lines, pending.Hole)
	}
}
func (m *Match) attack(source *Player, lines int) {
	opponents := []*Player{}
	for _, p := range m.Players {
		if p != source && !p.Board.Dead {
			opponents = append(opponents, p)
		}
	}
	if len(opponents) == 0 {
		return
	}
	target := opponents[source.Target%len(opponents)]
	source.Target++
	// Garbage holes use match time, not the piece RNG: bags stay identical for all players.
	hole := int((m.Elapsed/50 + int64(source.Target)*7) % Width)
	target.Pending = append(target.Pending, Pending{Lines: lines, Due: m.Elapsed + 1500, Hole: hole})
}
func (m *Match) finish(now time.Time) {
	alive := 0
	for _, p := range m.Players {
		if p.Board.Dead {
			if p.EliminatedAt == 0 {
				p.EliminatedAt = max(1, m.Elapsed)
			}
		} else {
			alive++
		}
	}
	if (m.Mode == "solo" && alive == 0) || (m.Mode == "versus" && alive <= 1) {
		m.Status = "finished"
		m.FinishedAt = now
	}
}
func (m Match) Place(p *Player) int {
	rank := 1
	for _, other := range m.Players {
		if other == p {
			continue
		}
		if p.Board.Dead && (!other.Board.Dead || other.EliminatedAt > p.EliminatedAt) {
			rank++
		}
	}
	return rank
}
