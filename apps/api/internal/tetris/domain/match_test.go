package domain

import (
	"testing"
	"time"
)

func actor(key string) Actor { return Actor{Key: key, Room: "lobby", Nickname: key} }
func TestLobbyCapacityEarlyStartAndOwnership(t *testing.T) {
	now := time.Now()
	m := NewMatch("game", "ЛИСА-27", actor("one"), false, 1, now)
	if err := m.Join(actor("two"), now); err != nil {
		t.Fatal(err)
	}
	if err := m.Start("two", now); err != ErrForbidden {
		t.Fatal("non-host start allowed")
	}
	if err := m.Start("one", now); err != ErrInvalid {
		t.Fatal("start without readiness")
	}
	for _, key := range []string{"one", "two"} {
		if err := m.Ready(key, true); err != nil {
			t.Fatal(err)
		}
	}
	if err := m.Start("one", now); err != nil {
		t.Fatal(err)
	}
	if err := m.Join(actor("three"), now); err != ErrFull {
		t.Fatal("late join allowed")
	}
	m.Tick(50, now.Add(3*time.Second))
	if m.Status != "running" {
		t.Fatal(m.Status)
	}
	if err := m.Input("observer", "drop", 1, now); err != ErrInvalid {
		t.Fatal("observer input allowed")
	}
	x := m.Player("one").Board.Active.X
	if err := m.Input("one", "left", 1, now); err != nil {
		t.Fatal(err)
	}
	if err := m.Input("one", "left", 1, now); err != nil {
		t.Fatal(err)
	}
	if m.Player("one").Board.Active.X != x-1 {
		t.Fatal("duplicate command applied")
	}
}
func TestFullLobbyReopensAndHostTransfers(t *testing.T) {
	now := time.Now()
	m := NewMatch("g", "c", actor("one"), false, 1, now)
	for _, key := range []string{"two", "three"} {
		if err := m.Join(actor(key), now); err != nil {
			t.Fatal(err)
		}
	}
	if err := m.Join(actor("four"), now); err != ErrFull {
		t.Fatal(err)
	}
	previous := m.Player("three").ID
	m.Leave("one", now)
	if m.Host != "two" {
		t.Fatal("no host transfer")
	}
	if err := m.Join(actor("four"), now); err != nil {
		t.Fatal(err)
	}
	if m.Player("four").ID == previous {
		t.Fatal("player ID reused")
	}
}
func TestSoloPrivacyPauseAndDisconnect(t *testing.T) {
	now := time.Now()
	m := NewMatch("g", "c", actor("one"), true, 1, now)
	if m.Access(actor("two")) {
		t.Fatal("solo exposed")
	}
	m.Tick(50, now.Add(3*time.Second))
	if err := m.Input("one", "pause", 1, now); err != nil {
		t.Fatal(err)
	}
	before := m.Elapsed
	m.Tick(50, now.Add(4*time.Second))
	if m.Elapsed != before {
		t.Fatal("paused clock advanced")
	}
	m.Tick(50, now.Add(21*time.Second))
	if m.Status != "finished" {
		t.Fatal("disconnect not terminal")
	}
}
func TestAttacksCancelAndAlternate(t *testing.T) {
	now := time.Now()
	m := NewMatch("g", "c", actor("a"), false, 1, now)
	for _, key := range []string{"b", "c"} {
		if err := m.Join(actor(key), now); err != nil {
			t.Fatal(err)
		}
	}
	a, b, c := m.Players[0], m.Players[1], m.Players[2]
	m.attack(a, 2)
	m.attack(a, 2)
	if len(b.Pending) != 1 || len(c.Pending) != 1 {
		t.Fatal("targets not alternated")
	}
	m.outcome(b, Outcome{Attack: 2, Locked: true, Lines: 3})
	if len(b.Pending) != 0 || len(a.Pending) != 0 {
		t.Fatal("incoming attack not cancelled first")
	}
	m.Elapsed = 1600
	m.outcome(c, Outcome{Locked: true})
	if c.Board.Cells[19][0] != 8 && c.Board.Cells[19][1] != 8 {
		t.Fatal("due garbage not applied")
	}
}
func TestRankingTiesAndRatings(t *testing.T) {
	now := time.Now()
	m := NewMatch("g", "c", actor("a"), false, 1, now)
	if err := m.Join(actor("b"), now); err != nil {
		t.Fatal(err)
	}
	for _, p := range m.Players {
		p.Board.Dead = true
		p.EliminatedAt = 50
	}
	if m.Place(m.Players[0]) != 1 || m.Place(m.Players[1]) != 1 {
		t.Fatal("simultaneous deaths should tie")
	}
	for i, want := range []float64{16, 0, -16} {
		others := []float64{}
		places := []int{}
		for j := 0; j < 3; j++ {
			if i != j {
				others = append(others, 1000)
				places = append(places, j+1)
			}
		}
		if got := RatingChange(1000, i+1, others, places); got != want {
			t.Fatalf("place %d delta=%f", i+1, got)
		}
	}
}

func TestLateInputDoesNotControlSuccessor(t *testing.T) {
	now := time.Now()
	m := NewMatch("game", "code", Actor{Key: "a", Room: "r"}, true, 42, now)
	m.Tick(50, now.Add(3*time.Second))
	p := m.Players[0]
	first := p.Board.PieceID
	if err := m.InputForPiece("a", "drop", 1, first, now); err != nil {
		t.Fatal(err)
	}
	before := p.Board.Active
	if err := m.InputForPiece("a", "rotate", 2, first, now); err != nil {
		t.Fatal(err)
	}
	if p.Sequence != 2 || p.Board.Active != before || p.Board.PieceID != first+1 {
		t.Fatal("late input moved successor or was not acknowledged")
	}
	if err := m.InputForPiece("a", "right", 3, first+1, now); err != nil {
		t.Fatal(err)
	}
	if p.Board.Active.X != before.X+1 {
		t.Fatal("current piece input rejected")
	}
}
