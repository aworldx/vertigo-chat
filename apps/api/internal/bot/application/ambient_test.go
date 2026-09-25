package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"testing"
	"time"
)

func TestAmbientPacesAlternatesAndYields(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	audience := Audience{Humans: 1}
	var turns []Turn
	a := NewAmbient(AmbientPorts{Now: func() time.Time { return now }, Delay: func() time.Duration { return time.Minute }, Audience: func(context.Context) (Audience, error) { return audience, nil }, Talk: func(_ context.Context, turn Turn, allowed func() bool) (string, error) {
		if !allowed() {
			t.Fatal("expected publication")
		}
		turns = append(turns, turn)
		return "Как прошёл день?", nil
	}})
	step := func(d time.Duration) {
		t.Helper()
		now = now.Add(d)
		if err := a.Tick(ctx); err != nil {
			t.Fatal(err)
		}
	}
	step(0)
	step(89 * time.Second)
	if len(turns) != 0 {
		t.Fatal("spoke too early")
	}
	step(time.Second)
	if len(turns) != 1 || turns[0].Speaker.ID != "claire" {
		t.Fatal(turns)
	}
	step(time.Minute)
	if len(turns) != 2 || turns[1].Speaker.ID != "hitchcock" {
		t.Fatal(turns)
	}
	audience.Humans = 2
	step(30 * time.Second)
	if len(turns) != 2 {
		t.Fatal("rushed closing")
	}
	step(30 * time.Second)
	if len(turns) != 3 || !turns[2].Closing {
		t.Fatal(turns)
	}
	step(time.Hour)
	if len(turns) != 3 {
		t.Fatal("kept talking over people")
	}
	audience.Humans = 1
	step(0)
	step(90 * time.Second)
	if len(turns) != 4 || turns[3].Speaker.ID != "claire" {
		t.Fatal(turns)
	}
	audience.Humans = 0
	step(time.Hour)
	if len(turns) != 4 {
		t.Fatal("empty room chatter")
	}
}
func TestAmbientRechecksAudienceAndHumanActivity(t *testing.T) {
	for _, change := range []func(*Audience){func(a *Audience) { a.Humans = 2 }, func(a *Audience) { a.Humans = 0 }, func(a *Audience) { a.LastHuman = time.Now() }} {
		now := time.Now()
		audience := Audience{Humans: 1}
		calls := 0
		a := NewAmbient(AmbientPorts{Now: func() time.Time { return now }, Delay: func() time.Duration { return time.Minute }, Audience: func(context.Context) (Audience, error) { return audience, nil }, Talk: func(_ context.Context, _ Turn, allowed func() bool) (string, error) {
			calls++
			change(&audience)
			if allowed() {
				t.Fatal("stale response allowed")
			}
			return "", nil
		}})
		if err := a.Tick(context.Background()); err != nil {
			t.Fatal(err)
		}
		now = now.Add(2 * time.Minute)
		if err := a.Tick(context.Background()); err != nil {
			t.Fatal(err)
		}
		if calls != 1 {
			t.Fatal(calls)
		}
	}
}
func TestAmbientRestAndFailures(t *testing.T) {
	now := time.Now()
	audience := Audience{Humans: 1, LastHuman: now}
	calls := 0
	fail := false
	a := NewAmbient(AmbientPorts{Now: func() time.Time { return now }, Delay: func() time.Duration { return time.Minute }, Audience: func(context.Context) (Audience, error) { return audience, nil }, Talk: func(context.Context, Turn, func() bool) (string, error) {
		calls++
		if fail {
			return "", domain.ErrUnavailable
		}
		return "Привет", nil
	}})
	step := func(d time.Duration) error { now = now.Add(d); return a.Tick(context.Background()) }
	if err := step(0); err != nil {
		t.Fatal(err)
	}
	for range 6 {
		if err := step(90 * time.Second); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 6 {
		t.Fatal(calls)
	}
	if err := step(9 * time.Minute); err != nil {
		t.Fatal(err)
	}
	if calls != 6 {
		t.Fatal("missing intermission")
	}
	fail = true
	if err := step(time.Minute); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatal(err)
	}
	if err := step(time.Minute); err != nil {
		t.Fatal(err)
	}
	if calls != 7 {
		t.Fatal("retry storm")
	}
}
func TestAmbientAudienceErrors(t *testing.T) {
	want := errors.New("unavailable")
	a := NewAmbient(AmbientPorts{Audience: func(context.Context) (Audience, error) { return Audience{}, want }})
	if !errors.Is(a.Tick(context.Background()), want) {
		t.Fatal("ignored read error")
	}
}
func TestMediaCooldown(t *testing.T) {
	now := time.Now()
	calls := 0
	m := &Media{Now: func() time.Time { return now }, Publish: func(context.Context, string, string, string, string, func() bool) error {
		calls++
		return errors.New("search unavailable")
	}}
	m.Suggest(context.Background(), "lobby", "1", "music", "song", func() bool { return false })
	m.Suggest(context.Background(), "lobby", "1", "", "", nil)
	m.Suggest(context.Background(), "lobby", "1", "music", "song", nil)
	m.Suggest(context.Background(), "lobby", "2", "youtube", "song", nil)
	if calls != 1 {
		t.Fatal(calls)
	}
	now = now.Add(30 * time.Minute)
	m.Suggest(context.Background(), "lobby", "3", "youtube", "song", nil)
	if calls != 2 {
		t.Fatal(calls)
	}
}
