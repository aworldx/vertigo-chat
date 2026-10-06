package domain

import (
	"fmt"
	"testing"
	"time"
)

func ready(t *testing.T) (Game, time.Time) {
	t.Helper()
	now := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	g := New("game", now)
	qs := make([]Question, 5)
	for i := range qs {
		qs[i] = Question{ID: fmt.Sprint(i), PanoID: fmt.Sprint(i), Place: Place{Country: "Италия", City: "Манарола", Countries: []string{"Италия", "Italy", "IT"}, Cities: []string{"Манарола", "Manarola"}}}
	}
	if err := g.Ready(qs, now); err != nil {
		t.Fatal(err)
	}
	return g, now
}
func TestDeadlineReplaceAndLateJoin(t *testing.T) {
	g, now := ready(t)
	a := Actor{Key: "guest:a", Nickname: "Alice"}
	b := Actor{Key: "guest:b", Nickname: "Bob"}
	if err := g.Answer(a, g.ID, 1, "Италия", now); err != nil {
		t.Fatal(err)
	}
	if err := g.Answer(a, g.ID, 1, "Манарола", now); err != ErrLimit {
		t.Fatal("rate limit missing")
	}
	if err := g.Answer(a, g.ID, 1, "Италия, Манарола", now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := g.Answer(b, g.ID, 1, "Italy", now.Add(299*time.Second)); err != nil {
		t.Fatal(err)
	}
	if err := g.Answer(b, g.ID, 1, "Manarola", now.Add(5*time.Minute)); err != ErrConflict {
		t.Fatal("late answer accepted")
	}
	g.Advance(now.Add(5 * time.Minute))
	if g.Phase != "reveal" || g.Scores[a.Key].Points != 3 || g.Scores[b.Key].Points != 1 {
		t.Fatalf("bad reveal: %+v", g)
	}
	g.Advance(now.Add(305 * time.Second))
	if g.Scores[a.Key].Points != 3 {
		t.Fatal("scored twice")
	}
	g.Advance(now.Add(310 * time.Second))
	if g.Phase != "active" || g.Round != 2 || len(g.Answers) != 0 {
		t.Fatal("next round failed")
	}
	if err := g.Answer(a, g.ID, 1, "Italy", now.Add(311*time.Second)); err != ErrConflict {
		t.Fatal("stale answer accepted")
	}
}
func TestCatchupAndExpiry(t *testing.T) {
	g, now := ready(t)
	g.Advance(now.Add(26 * time.Minute))
	if g.Phase != "finished" || len(g.Questions) != 0 || len(g.Answers) != 0 {
		t.Fatal("finish did not purge answers/places")
	}
	g.Advance(now.Add(2 * time.Hour))
	if g.Phase != "" {
		t.Fatal("results did not expire")
	}
}
func TestAnswerMatching(t *testing.T) {
	g, _ := ready(t)
	p := g.Questions[0].Place
	for text, want := range map[string]int{"Италия": 1, " it ": 1, "ITALY": 1, "Манарола, Италия": 3, "italy / manarola": 3, "Spain": 0, "не Италия": 0, "Италия Франция": 0, "Манарола Рим": 0} {
		if got := p.Score(text); got != want {
			t.Errorf("%q=%d want%d", text, got, want)
		}
	}
}

func TestFiveMinutesAndRegisteredAwards(t *testing.T) {
	g, now := ready(t)
	a := Actor{Key: "user:42", Nickname: "Alice", Registered: true}
	if g.Deadline.Sub(now) != 5*time.Minute {
		t.Fatal("round must last five minutes")
	}
	if err := g.Answer(a, g.ID, 1, "Italy", now.Add(4*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := g.Answer(Actor{Key: "guest:x", Nickname: "Guest"}, g.ID, 1, "Manarola", now.Add(4*time.Minute)); err != nil {
		t.Fatal(err)
	}
	g.Advance(now.Add(5 * time.Minute))
	g.Advance(now.Add(5 * time.Minute))
	if len(g.Awards) != 1 || g.Awards[0].Points != 1 || g.Awards[0].Identity != "user:42" {
		t.Fatalf("invalid awards: %+v", g.Awards)
	}
}
