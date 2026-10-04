package http

import (
	"chat/api/internal/tetris/domain"
	"time"
)

type pieceDTO struct {
	Kind     int `json:"kind"`
	Rotation int `json:"rotation"`
	X        int `json:"x"`
	Y        int `json:"y"`
}
type pendingDTO struct {
	Lines int   `json:"lines"`
	Due   int64 `json:"due"`
	Hole  int   `json:"hole"`
}
type simulationDTO struct {
	PieceID int64        `json:"piece_id"`
	FallMS  int          `json:"fall_ms"`
	LockMS  int          `json:"lock_ms"`
	Resets  int          `json:"resets"`
	Combo   int          `json:"combo"`
	Random  uint32       `json:"random"`
	Bag     []int        `json:"bag"`
	Pending []pendingDTO `json:"pending"`
}
type playerDTO struct {
	Simulation *simulationDTO `json:"simulation,omitempty"`
	ID         string         `json:"id"`
	Nickname   string         `json:"nickname"`
	Registered bool           `json:"registered"`
	Ready      bool           `json:"ready"`
	Connected  bool           `json:"connected"`
	Dead       bool           `json:"dead"`
	Place      int            `json:"place"`
	Score      int            `json:"score"`
	Lines      int            `json:"lines"`
	Level      int            `json:"level"`
	Cells      [20][10]int    `json:"cells"`
	Active     pieceDTO       `json:"active"`
	Ghost      pieceDTO       `json:"ghost"`
	Next       []int          `json:"next"`
	Hold       int            `json:"hold"`
	CanHold    bool           `json:"can_hold"`
	Incoming   int            `json:"incoming"`
	Target     string         `json:"target"`
	Sequence   int64          `json:"sequence"`
}
type gameDTO struct {
	ClientClock bool        `json:"client_clock,omitempty"`
	Revision    int64       `json:"revision"`
	ID          string      `json:"id"`
	Code        string      `json:"code"`
	Mode        string      `json:"mode"`
	Status      string      `json:"status"`
	Self        string      `json:"self"`
	Host        string      `json:"host"`
	Paused      bool        `json:"paused"`
	Countdown   int         `json:"countdown"`
	Elapsed     int64       `json:"elapsed_ms"`
	Players     []playerDTO `json:"players"`
}

func piece(p domain.Piece) pieceDTO {
	return pieceDTO{Kind: p.Kind, Rotation: p.Rotation, X: p.X, Y: p.Y}
}
func encode(m *domain.Match, a domain.Actor) gameDTO {
	g := gameDTO{ClientClock: m.ClientClock, Revision: m.Revision, ID: m.ID, Code: m.Code, Mode: m.Mode, Status: m.Status, Paused: m.Paused, Elapsed: m.Elapsed, Players: []playerDTO{}}
	if m.Status == "countdown" {
		g.Countdown = max(0, int(time.Until(m.StartedAt).Milliseconds()+999)/1000)
	}
	for _, p := range m.Players {
		b := p.Board
		v := playerDTO{ID: p.ID, Nickname: p.Actor.Nickname, Registered: p.Actor.UserID > 0, Ready: p.Ready, Connected: time.Since(p.LastSeen) < 5*time.Second, Dead: b.Dead, Score: b.Score, Lines: b.Lines, Level: b.Level(), Cells: b.Cells, Active: piece(b.Active), Ghost: piece(b.Ghost()), Next: b.Next, Hold: b.Hold, CanHold: b.CanHold, Sequence: p.Sequence}
		if p.Actor.Key == a.Key {
			v.Simulation = &simulationDTO{PieceID: b.PieceID, FallMS: b.FallMS, LockMS: b.LockMS, Resets: b.Resets, Combo: b.Combo, Random: b.Random, Bag: append([]int{}, b.Bag...), Pending: []pendingDTO{}}
			for _, pending := range p.Pending {
				v.Simulation.Pending = append(v.Simulation.Pending, pendingDTO{pending.Lines, pending.Due, pending.Hole})
			}
		}
		if m.Status == "finished" {
			v.Place = m.Place(p)
		}
		for _, pending := range p.Pending {
			v.Incoming += pending.Lines
		}
		opponents := []string{}
		for _, other := range m.Players {
			if other != p && !other.Board.Dead {
				opponents = append(opponents, other.Actor.Nickname)
			}
		}
		if len(opponents) > 0 {
			v.Target = opponents[p.Target%len(opponents)]
		}
		g.Players = append(g.Players, v)
		if p.Actor.Key == a.Key {
			g.Self = p.ID
		}
		if p.Actor.Key == m.Host {
			g.Host = p.ID
		}
	}
	return g
}
