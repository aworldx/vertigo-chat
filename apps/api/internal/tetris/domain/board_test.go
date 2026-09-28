package domain

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestBagHoldAndDeterminism(t *testing.T) {
	a, b := NewBoard(42), NewBoard(42)
	if !reflect.DeepEqual(a, b) {
		t.Fatal("seed differs")
	}
	bag := append([]int{a.Active.Kind}, a.Next...)
	bag = append(bag, a.Bag...)
	seen := map[int]bool{}
	for _, p := range bag[:7] {
		seen[p] = true
	}
	if len(seen) != 7 {
		t.Fatal("bag does not contain seven pieces")
	}
	first := a.Active.Kind
	a.Apply("hold", 0)
	if a.Hold != first || a.CanHold {
		t.Fatal("hold failed")
	}
	held := a.Active
	a.Apply("hold", 0)
	if a.Active != held {
		t.Fatal("second hold allowed")
	}
	a.Apply("drop", 0)
	if !a.CanHold {
		t.Fatal("hold not reset after lock")
	}
}
func TestScoringComboAndLevelBoundary(t *testing.T) {
	b := NewBoard(1)
	b.Lines = 9
	prepare := func() {
		b.Cells = [Height][Width]int{}
		for x := 0; x < Width; x++ {
			if x < 3 || x > 6 {
				b.Cells[19][x] = 8
			}
		}
		b.Active = Piece{Kind: 1, X: 3, Y: 18}
	}
	prepare()
	r := b.Apply("drop", 0)
	if r.Lines != 1 || b.Score != 100 || b.Level() != 2 {
		t.Fatalf("boundary score=%d level=%d lines=%d", b.Score, b.Level(), r.Lines)
	}
	prepare()
	b.Apply("drop", 0)
	if b.Score != 400 || b.Combo != 1 {
		t.Fatalf("combo score=%d combo=%d", b.Score, b.Combo)
	}
	b.Apply("drop", 0)
	if b.Combo != -1 {
		t.Fatal("combo not reset")
	}
}
func TestFourLinesAndAttack(t *testing.T) {
	b := NewBoard(2)
	b.Lines = 20
	for y := 16; y < 20; y++ {
		for x := 0; x < 10; x++ {
			if x != 5 {
				b.Cells[y][x] = 8
			}
		}
	}
	b.Active = Piece{Kind: 1, Rotation: 1, X: 3, Y: 16}
	r := b.Apply("drop", 0)
	if r.Lines != 4 || r.Attack != 4 || b.Score != 2400 {
		t.Fatalf("clear=%+v score=%d", r, b.Score)
	}
}
func TestCollisionGravityAndGarbage(t *testing.T) {
	b := NewBoard(2)
	for range 20 {
		b.Apply("left", 0)
	}
	for _, c := range Blocks(b.Active) {
		if c.X < 0 {
			t.Fatal("crossed wall")
		}
	}
	for range 500 {
		b.Apply("tick", 50)
		if b.Dead {
			break
		}
	}
	filled := false
	for _, row := range b.Cells {
		for _, cell := range row {
			filled = filled || cell != 0
		}
	}
	if !filled {
		t.Fatal("gravity did not lock")
	}
	b = NewBoard(2)
	seed := b.Random
	b.Garbage(2, 3)
	if b.Cells[19][3] != 0 || b.Cells[19][4] != 8 || b.Random != seed {
		t.Fatal("garbage changed bag or hole")
	}
	b.Cells[0][0] = 8
	b.Garbage(1, 2)
	if !b.Dead {
		t.Fatal("overflow not terminal")
	}
}

func TestSharedPieceFixtures(t *testing.T) {
	data, err := os.ReadFile("../../../../../contracts/fixtures/tetris-pieces.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Piece Piece     `json:"piece"`
		Cells [4][2]int `json:"cells"`
	}
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		actual := Blocks(fixture.Piece)
		for i, c := range fixture.Cells {
			if actual[i].X != c[0] || actual[i].Y != c[1] {
				t.Fatalf("piece %+v: %+v", fixture.Piece, actual)
			}
		}
	}
}
