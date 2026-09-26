package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"testing"
	"time"
)

type settingsMemory struct {
	limits Limits
	styles map[string]Style
	writes int
}

func (s *settingsMemory) ReadLimits(context.Context) (Limits, error) { return s.limits, nil }
func (s *settingsMemory) SaveLimits(_ context.Context, v Limits) error {
	s.limits = v
	s.writes++
	return nil
}
func (s *settingsMemory) ReadStyle(_ context.Context, id string) (Style, error) {
	return s.styles[id], nil
}
func (s *settingsMemory) SaveStyle(_ context.Context, id string, v Style) error {
	s.styles[id] = v
	s.writes++
	return nil
}
func (s *settingsMemory) ReadBudget(context.Context, time.Time) (Budget, error) {
	return domain.NewBudget(s.limits.DailyTokens, 20, 90), nil
}
func TestSettingsAuthorization(t *testing.T) {
	ctx := context.Background()
	store := &settingsMemory{limits: Limits{DailyTokens: 100, StopPercent: 90}, styles: map[string]Style{"hitchcock": domain.DefaultStyle(), "claire": domain.DefaultStyle()}}
	service := NewSettings(store, func(_ context.Context, id int64) (bool, error) { return id == 1, nil })
	for _, user := range []int64{0, 2} {
		if _, err := service.Read(ctx, user); !errors.Is(err, ErrForbidden) {
			t.Fatal(err)
		}
		if err := service.UpdateLimits(ctx, user, Limits{DailyTokens: 200, StopPercent: 90}); !errors.Is(err, ErrForbidden) {
			t.Fatal(err)
		}
		if err := service.UpdateStyle(ctx, user, "claire", domain.DefaultStyle()); !errors.Is(err, ErrForbidden) {
			t.Fatal(err)
		}
	}
	if store.writes != 0 {
		t.Fatal("unauthorized settings persisted")
	}
}

func TestSettingsValidation(t *testing.T) {
	ctx := context.Background()
	store := &settingsMemory{limits: Limits{DailyTokens: 100, StopPercent: 90}, styles: map[string]Style{"hitchcock": domain.DefaultStyle(), "claire": domain.DefaultStyle()}}
	service := NewSettings(store, func(_ context.Context, id int64) (bool, error) { return id == 1, nil })
	for _, limits := range []Limits{{DailyTokens: -1, StopPercent: 90}, {DailyTokens: 1000000001, StopPercent: 90}, {DailyTokens: 100, StopPercent: 0}, {DailyTokens: 100, StopPercent: 101}} {
		if err := service.UpdateLimits(ctx, 1, limits); !errors.Is(err, ErrInvalidSettings) {
			t.Fatal(limits, err)
		}
	}
	for _, change := range []func(*Style){func(s *Style) { s.Dark.Text = "red" }, func(s *Style) { s.Light.Nickname = "url(x)" }, func(s *Style) { s.Font = "custom" }, func(s *Style) { s.FontStyle = "bold" }} {
		style := domain.DefaultStyle()
		change(&style)
		if err := service.UpdateStyle(ctx, 1, "claire", style); !errors.Is(err, ErrInvalidSettings) {
			t.Fatal(style, err)
		}
	}
	if err := service.UpdateStyle(ctx, 1, "unknown", domain.DefaultStyle()); !errors.Is(err, ErrInvalidSettings) {
		t.Fatal(err)
	}
	if store.writes != 0 {
		t.Fatal("unauthorized or invalid settings persisted")
	}
}

func TestSettingsPersist(t *testing.T) {
	ctx := context.Background()
	store := &settingsMemory{limits: Limits{DailyTokens: 100, StopPercent: 90}, styles: map[string]Style{"hitchcock": domain.DefaultStyle(), "claire": domain.DefaultStyle()}}
	service := NewSettings(store, func(_ context.Context, id int64) (bool, error) { return id == 1, nil })
	if err := service.UpdateLimits(ctx, 1, Limits{DailyTokens: 0, StopPercent: 100}); err != nil {
		t.Fatal(err)
	}
	style := domain.DefaultStyle()
	style.Font = "serif"
	style.FontStyle = "italic"
	if err := service.UpdateStyle(ctx, 1, "claire", style); err != nil {
		t.Fatal(err)
	}
	overview, err := service.Read(ctx, 1)
	if err != nil || overview.Limits.DailyTokens != 0 || len(overview.Bots) != 2 || overview.Bots[1].Style != style {
		t.Fatal(overview, err)
	}
}
