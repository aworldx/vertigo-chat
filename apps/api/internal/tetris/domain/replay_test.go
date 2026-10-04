package domain

import (
	"reflect"
	"testing"
	"time"
)

func replayGame(now time.Time) *Match {
	m := NewMatch("solo", "code", Actor{Key: "a", Room: "r"}, true, 42, now.Add(-time.Minute))
	m.Status = "running"
	m.StartedAt = now.Add(-time.Minute)
	m.ClientClock = true
	return m
}
func TestReplayOwnsSoloClockAndCalculatesScore(t *testing.T) {
	now := time.Now()
	m := replayGame(now)
	before := m.Players[0].Board
	m.Tick(50, now)
	if m.Elapsed != 0 || !reflect.DeepEqual(before, m.Players[0].Board) {
		t.Fatal("server advanced local game")
	}
	m.Tick(50, now.Add(30*time.Second))
	if m.Status != "running" {
		t.Fatal("brief disconnection ended solo")
	}
	inputs := []ReplayInput{{Type: "right", Sequence: 1, PieceID: 1, At: 850}, {Type: "drop", Sequence: 2, PieceID: 1, At: 900}}
	if err := m.Replay("a", 1000, inputs, now); err != nil {
		t.Fatal(err)
	}
	want := NewBoard(42)
	for range 17 {
		want.Apply("tick", 50)
	}
	want.Apply("right", 0)
	want.Apply("tick", 50)
	want.Apply("drop", 0)
	want.Apply("tick", 50)
	want.Apply("tick", 50)
	if !reflect.DeepEqual(m.Players[0].Board, want) {
		t.Fatal("journal differs from deterministic board")
	}
	if err := m.Replay("a", 1000, inputs, now); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(m.Players[0].Board, want) {
		t.Fatal("duplicate batch scored twice")
	}
}
func TestReplayPauseAndClockBounds(t *testing.T) {
	now := time.Now()
	m := replayGame(now)
	if err := m.Replay("a", 0, []ReplayInput{{Type: "pause", Sequence: 1, PieceID: 1, At: 0}}, now); err != nil {
		t.Fatal(err)
	}
	if err := m.Replay("a", 50, nil, now); err == nil {
		t.Fatal("advanced through pause")
	}
	if err := m.Replay("a", 50, []ReplayInput{{Type: "pause", Sequence: 2, PieceID: 1, At: 0}}, now); err != nil {
		t.Fatal(err)
	}
	for _, through := range []int64{-50, 51, 20000, 100000} {
		if err := m.Replay("a", through, nil, now); err == nil {
			t.Fatalf("accepted time %d", through)
		}
	}
	if err := m.Replay("stranger", 50, nil, now); err == nil {
		t.Fatal("accepted wrong owner")
	}
	m.Mode = "versus"
	if err := m.Replay("a", 50, nil, now); err == nil {
		t.Fatal("accepted multiplayer local clock")
	}
}
