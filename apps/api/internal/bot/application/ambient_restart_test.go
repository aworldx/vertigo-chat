package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

func TestAmbientRestoresPendingReplyAndContext(t *testing.T) {
	now := time.Now().UTC()
	history := []AmbientMessage{{Speaker: "claire", Body: "Я нашла старый билет", SentAt: now.Add(-2 * time.Minute)}}
	var turns []Turn
	fail := true
	ports := AmbientPorts{Now: func() time.Time { return now }, Delay: func() time.Duration { return time.Minute }, Audience: func(context.Context) (Audience, error) { return Audience{Humans: 1, History: history}, nil }, Talk: func(_ context.Context, turn Turn, _ func() bool) (string, error) {
		turns = append(turns, turn)
		if fail {
			return "", errors.New("temporary failure")
		}
		history = append(history, AmbientMessage{Speaker: turn.Speaker.ID, Body: "Я храню такие билеты", SentAt: now})
		return "Я храню такие билеты", nil
	}}
	a := NewAmbient(ports)
	if a.Tick(context.Background()) == nil {
		t.Fatal("expected generation failure")
	}
	fail = false
	// A new leader must still answer the unpublished turn, not start Claire again.
	a = NewAmbient(ports)
	if err := a.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, turn := range turns {
		if turn.Speaker.ID != "hitchcock" || !strings.Contains(turn.Body, "старый билет") {
			t.Fatal(turn)
		}
	}
	now = now.Add(time.Minute)
	a = NewAmbient(ports)
	if err := a.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if turns[2].Speaker.ID != "claire" || !strings.Contains(turns[2].Body, "храню такие билеты") {
		t.Fatal(turns[2])
	}
}

func TestAmbientRestoresIntermissionAndOldContext(t *testing.T) {
	now := time.Now().UTC()
	history := make([]AmbientMessage, 6)
	for i := range history {
		speaker := "claire"
		if i%2 == 1 {
			speaker = "hitchcock"
		}
		history[i] = AmbientMessage{Speaker: speaker, Body: strings.Repeat("я", 400), SentAt: now.Add(time.Duration(i-5) * time.Minute)}
	}
	for _, age := range []time.Duration{0, 31 * time.Minute} {
		calls := 0
		current := now.Add(age)
		a := NewAmbient(AmbientPorts{Now: func() time.Time { return current }, Delay: func() time.Duration { return time.Minute }, Audience: func(context.Context) (Audience, error) { return Audience{Humans: 1, History: history}, nil }, MediaReady: func(context.Context) bool { return true }, Talk: func(_ context.Context, turn Turn, _ func() bool) (string, error) {
			calls++
			if calls == 3 && !strings.Contains(turn.Body, "/music") {
				t.Fatal("missing occasional music opportunity")
			}
			if utf8.RuneCountInString(turn.Body) > 1000 {
				t.Fatal("context exceeds provider request limit")
			}
			return "Ответ", nil
		}})
		if err := a.Tick(context.Background()); err != nil {
			t.Fatal(err)
		}
		if calls != 0 {
			t.Fatal("restarted too soon")
		}
		current = current.Add(10 * time.Minute)
		for range 3 {
			if err := a.Tick(context.Background()); err != nil {
				t.Fatal(err)
			}
			current = current.Add(time.Minute)
		}
		if calls != 3 {
			t.Fatal(calls)
		}
	}
	// Recover even the old broken sequence with repeated Claire monologues.
	for i := range history {
		history[i].Speaker = "claire"
	}
	a := NewAmbient(AmbientPorts{Delay: func() time.Duration { return time.Minute }})
	a.restore(history, now)
	if a.turn(false).Speaker.ID != "hitchcock" {
		t.Fatal("lost pending question")
	}
}

func TestMediaRechecksCrowdAndCooldown(t *testing.T) {
	now := time.Now()
	quiet := false
	calls := 0
	m := &Media{Now: func() time.Time { return now }, Eligible: func(context.Context, string) bool { return quiet }, Publish: func(_ context.Context, _, _, _, _ string, allowed func() bool) error {
		calls++
		quiet = false
		if allowed() {
			t.Fatal("crowd change ignored")
		}
		return nil
	}}
	ctx := context.Background()
	m.Suggest(ctx, "lobby", "1", "music", "song", nil)
	if calls != 0 {
		t.Fatal("music in crowded room")
	}
	quiet = true
	m.Suggest(ctx, "lobby", "2", "music", "song", nil)
	quiet = true
	now = now.Add(29 * time.Minute)
	if m.Ready(ctx, "lobby") {
		t.Fatal("cooldown ignored")
	}
	now = now.Add(time.Minute)
	if !m.Ready(ctx, "lobby") {
		t.Fatal("never becomes ready")
	}
}
