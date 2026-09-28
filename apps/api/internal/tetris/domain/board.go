// Package domain contains deterministic falling-block rules, independent of rendering and transport.
package domain

const Width, Height = 10, 20

type Cell struct{ X, Y int }
type Piece struct{ Kind, Rotation, X, Y int }
type Board struct {
	Cells                     [Height][Width]int
	Active                    Piece
	Next                      []int
	Hold, Score, Lines, Combo int
	CanHold, Dead             bool
	Random                    uint32
	Bag                       []int
	FallMS, LockMS, Resets    int
}
type Outcome struct {
	Lines, Attack int
	Locked        bool
}

var shapes = [7][4]Cell{
	{{0, 1}, {1, 1}, {2, 1}, {3, 1}}, // I
	{{1, 0}, {2, 0}, {1, 1}, {2, 1}}, // O
	{{1, 0}, {0, 1}, {1, 1}, {2, 1}}, // T
	{{1, 0}, {2, 0}, {0, 1}, {1, 1}}, // S
	{{0, 0}, {1, 0}, {1, 1}, {2, 1}}, // Z
	{{0, 0}, {0, 1}, {1, 1}, {2, 1}}, // J
	{{2, 0}, {0, 1}, {1, 1}, {2, 1}}, // L
}

func Blocks(p Piece) [4]Cell {
	cells := shapes[p.Kind-1]
	if p.Kind != 2 {
		size := 3
		if p.Kind == 1 {
			size = 4
		}
		for r := 0; r < p.Rotation; r++ {
			for i, c := range cells {
				cells[i] = Cell{size - 1 - c.Y, c.X}
			}
		}
	}
	for i := range cells {
		cells[i].X += p.X
		cells[i].Y += p.Y
	}
	return cells
}
func NewBoard(seed uint32) Board {
	b := Board{Random: seed, Combo: -1, CanHold: true}
	if b.Random == 0 {
		b.Random = 1
	}
	for range 6 {
		b.Next = append(b.Next, b.draw())
	}
	b.spawn()
	return b
}
func (b *Board) random(n int) int {
	x := b.Random
	x ^= x << 13
	x ^= x >> 17
	x ^= x << 5
	b.Random = x
	return int(x % uint32(n))
}
func (b *Board) draw() int {
	if len(b.Bag) == 0 {
		b.Bag = []int{1, 2, 3, 4, 5, 6, 7}
		for i := 6; i > 0; i-- {
			j := b.random(i + 1)
			b.Bag[i], b.Bag[j] = b.Bag[j], b.Bag[i]
		}
	}
	p := b.Bag[0]
	b.Bag = b.Bag[1:]
	return p
}
func (b *Board) spawn() {
	p := b.Next[0]
	b.Next = append(b.Next[1:], b.draw())
	b.setPiece(p)
	b.CanHold = true
}
func (b *Board) setPiece(kind int) {
	b.Active = Piece{Kind: kind, X: 3, Y: 0}
	b.FallMS = 0
	b.LockMS = 0
	b.Resets = 0
	if !b.fits(b.Active) {
		b.Dead = true
	}
}
func (b Board) fits(p Piece) bool {
	for _, c := range Blocks(p) {
		if c.X < 0 || c.X >= Width || c.Y >= Height || c.Y < 0 {
			return false
		}
		if b.Cells[c.Y][c.X] != 0 {
			return false
		}
	}
	return true
}
func (b *Board) move(dx, dy int) bool {
	p := b.Active
	p.X += dx
	p.Y += dy
	if !b.fits(p) {
		return false
	}
	b.Active = p
	return true
}
func (b *Board) resetLock() {
	if b.Resets < 15 && b.LockMS > 0 {
		b.LockMS = 0
		b.Resets++
	}
}
func (b *Board) rotate(direction int) {
	p := b.Active
	p.Rotation = (p.Rotation + direction + 4) % 4
	// Small bounded wall/floor kicks; shared fixtures lock down this game's rules.
	for _, kick := range []Cell{{0, 0}, {-1, 0}, {1, 0}, {-2, 0}, {2, 0}, {0, -1}, {0, -2}} {
		q := p
		q.X += kick.X
		q.Y += kick.Y
		if b.fits(q) {
			b.Active = q
			b.resetLock()
			return
		}
	}
}
func (b *Board) Input(action string) Outcome {
	if b.Dead {
		return Outcome{}
	}
	switch action {
	case "left":
		if b.move(-1, 0) {
			b.resetLock()
		}
	case "right":
		if b.move(1, 0) {
			b.resetLock()
		}
	case "down":
		if b.move(0, 1) {
			b.Score++
		}
	case "rotate":
		b.rotate(1)
	case "counterrotate":
		b.rotate(-1)
	case "drop":
		for b.move(0, 1) {
			b.Score += 2
		}
		return b.lock()
	case "hold":
		if b.CanHold {
			previous := b.Hold
			b.Hold = b.Active.Kind
			if previous == 0 {
				b.spawn()
			} else {
				b.setPiece(previous)
			}
			b.CanHold = false
		}
	}
	return Outcome{}
}
func (b Board) Level() int { return 1 + b.Lines/10 }
func (b *Board) Tick(ms int) Outcome {
	if b.Dead {
		return Outcome{}
	}
	b.FallMS += ms
	interval := max(70, 850-(b.Level()-1)*60)
	if b.FallMS >= interval {
		b.FallMS -= interval
		b.move(0, 1)
	}
	p := b.Active
	p.Y++
	if b.fits(p) {
		b.LockMS = 0
	} else {
		b.LockMS += ms
	}
	if b.LockMS >= 500 {
		return b.lock()
	}
	return Outcome{}
}
func (b *Board) lock() Outcome {
	for _, c := range Blocks(b.Active) {
		b.Cells[c.Y][c.X] = b.Active.Kind
	}
	level := b.Level()
	cleared := 0
	write := Height - 1
	for y := Height - 1; y >= 0; y-- {
		full := true
		for _, v := range b.Cells[y] {
			if v == 0 {
				full = false
				break
			}
		}
		if full {
			cleared++
		} else {
			b.Cells[write] = b.Cells[y]
			write--
		}
	}
	for y := write; y >= 0; y-- {
		b.Cells[y] = [Width]int{}
	}
	b.Combo = -1
	// Combo is set by lockWithCombo below via the previous chain count.
	b.Score += []int{0, 100, 300, 500, 800}[cleared] * level
	b.Lines += cleared
	b.spawn()
	return Outcome{Lines: cleared, Attack: []int{0, 0, 1, 2, 4}[cleared], Locked: true}
}
func (b *Board) Apply(action string, ms int) Outcome {
	previous, level := b.Combo, b.Level()
	var result Outcome
	if action == "tick" {
		result = b.Tick(ms)
	} else {
		result = b.Input(action)
	}
	if result.Locked && result.Lines > 0 {
		b.Combo = previous + 1
		b.Score += 50 * max(0, b.Combo) * level
	}
	return result
}
func (b *Board) Garbage(lines, hole int) {
	for range lines {
		for _, c := range b.Cells[0] {
			if c != 0 {
				b.Dead = true
			}
		}
		for y := 0; y < Height-1; y++ {
			b.Cells[y] = b.Cells[y+1]
		}
		for x := 0; x < Width; x++ {
			b.Cells[Height-1][x] = 8
		}
		b.Cells[Height-1][hole%Width] = 0
	}
	if !b.fits(b.Active) {
		b.Dead = true
	}
}
func (b Board) Ghost() Piece {
	p := b.Active
	for {
		q := p
		q.Y++
		if !b.fits(q) {
			return p
		}
		p = q
	}
}
