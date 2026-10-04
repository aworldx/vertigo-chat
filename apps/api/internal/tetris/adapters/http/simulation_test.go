package http

import (
	"bytes"
	"chat/api/internal/tetris/domain"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type simulationStep struct {
	Action string  `json:"action"`
	Count  int     `json:"count"`
	Game   gameDTO `json:"game"`
}
type simulationTrace struct {
	Name    string           `json:"name"`
	Initial gameDTO          `json:"initial"`
	Steps   []simulationStep `json:"steps"`
}

// The Go authority and TypeScript engine consume these same full checkpoints.
// Regenerate intentionally with UPDATE_TETRIS_FIXTURES=1, never in the release gate.
func TestSimulationTraceParity(t *testing.T) {
	actor := domain.Actor{Key: "self", Room: "room", Nickname: "Игрок"}
	traces := []simulationTrace{}
	for _, scenario := range []string{"movement-lock-hold", "clear-combo-garbage", "four-lines-cancel", "lock-reset-limit", "top-out"} {
		now := time.Unix(1700000000, 0)
		m, actions := simulationScenario(scenario, actor, now)
		trace := simulationTrace{Name: scenario, Initial: encode(m, actor)}
		appendStep := func(action string, count int) {
			for i := 0; i < count; i++ {
				now = simulationAction(m, actor, action, now)
			}
			trace.Steps = append(trace.Steps, simulationStep{Action: action, Count: count, Game: encode(m, actor)})
		}

		if scenario == "lock-reset-limit" {
			for i := 0; i < 17; i++ {
				appendStep("tick", 9)
				if i%2 == 0 {
					appendStep("left", 1)
				} else {
					appendStep("right", 1)
				}
			}
		}
		for _, action := range actions {
			appendStep(action, 1)
		}
		for i := 0; i < 30; i++ {
			appendStep("rotate", 1)
			appendStep("tick", 17)
		}
		traces = append(traces, trace)
	}
	encoded, err := json.Marshal(traces)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join("..", "..", "..", "..", "..", "..", "contracts", "fixtures", "tetris-simulation.json")
	if os.Getenv("UPDATE_TETRIS_FIXTURES") == "1" {
		if err := os.WriteFile(path, encoded, 0600); err != nil {
			t.Fatal(err)
		}
	}
	expected, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(expected, encoded) {
		t.Fatal("Go rules changed: review and regenerate shared simulation traces")
	}
}

func simulationScenario(scenario string, actor domain.Actor, now time.Time) (*domain.Match, []string) {
	m := domain.NewMatch("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "ЛИСА-27", actor, true, 123456, now)
	m.Status = "running"
	p := m.Players[0]
	b := &p.Board
	actions := []string{"left", "rotate", "counterrotate", "right", "hold", "hold", "drop", "hold", "drop"}
	if scenario == "clear-combo-garbage" || scenario == "four-lines-cancel" {
		m.Mode = "versus"
		m.Players = append(m.Players, &domain.Player{Actor: domain.Actor{Key: "opponent", Room: "room"}, ID: "other", Board: domain.NewBoard(123456), LastSeen: now})
		b.Active = domain.Piece{Kind: 1, X: 3, Y: 18}
		b.Next = []int{1, 2, 3, 4, 5, 6}
		for y := 18; y < 20; y++ {
			for x := 0; x < 10; x++ {
				if x < 3 || x > 6 {
					b.Cells[y][x] = 7
				}
			}
		}
		b.Combo = 0
		p.Pending = []domain.Pending{{Lines: 2, Due: 0, Hole: 2}}
		actions = []string{"drop", "drop", "hold", "drop"}
	}
	if scenario == "four-lines-cancel" {
		b.Active = domain.Piece{Kind: 1, Rotation: 1, X: 1, Y: 16}
		b.Lines = 9
		for y := 16; y < 20; y++ {
			for x := 0; x < 10; x++ {
				b.Cells[y][x] = 7
			}
			b.Cells[y][3] = 0
		}
	}
	if scenario == "lock-reset-limit" {
		b.Active = domain.Piece{Kind: 2, X: 3, Y: 18}
		actions = nil
	}

	if scenario == "top-out" {
		for y := 2; y < 20; y++ {
			for x := 0; x < 10; x++ {
				b.Cells[y][x] = 8
			}
			b.Cells[y][0] = 0
		}
		actions = []string{"drop", "left", "rotate", "hold"}
	}

	return m, actions
}

func simulationAction(m *domain.Match, actor domain.Actor, action string, now time.Time) time.Time {
	if action == "tick" {
		now = now.Add(50 * time.Millisecond)
		for _, player := range m.Players {
			player.LastSeen = now
		}
		m.Tick(50, now)
	} else {
		_ = m.Input(actor.Key, action, m.Players[0].Sequence+1, now)
	}
	return now
}
