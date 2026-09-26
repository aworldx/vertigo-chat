package application

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"time"
)

type Limits = domain.Limits
type Style = domain.Style

var ErrForbidden = errors.New("forbidden")
var ErrInvalidSettings = domain.ErrInvalidSettings

type SettingsStore interface {
	ReadLimits(context.Context) (Limits, error)
	SaveLimits(context.Context, Limits) error
	ReadStyle(context.Context, string) (Style, error)
	SaveStyle(context.Context, string, Style) error
	ReadBudget(context.Context, time.Time) (Budget, error)
}
type Settings struct {
	store   SettingsStore
	allowed func(context.Context, int64) (bool, error)
}
type BotSettings struct {
	ID, Name string
	Style    Style
}
type Overview struct {
	Limits Limits
	Budget Budget
	Bots   []BotSettings
}

func NewSettings(s SettingsStore, allowed func(context.Context, int64) (bool, error)) Settings {
	return Settings{s, allowed}
}
func (s Settings) authorize(ctx context.Context, user int64) error {
	ok, err := s.allowed(ctx, user)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}
func (s Settings) Read(ctx context.Context, user int64) (Overview, error) {
	var v Overview
	if err := s.authorize(ctx, user); err != nil {
		return v, err
	}
	var err error
	v.Limits, err = s.store.ReadLimits(ctx)
	if err != nil {
		return v, err
	}
	v.Budget, err = s.store.ReadBudget(ctx, time.Now())
	if err != nil {
		return v, err
	}
	for _, p := range []domain.Persona{domain.Hitchcock(), domain.Claire()} {
		style, err := s.store.ReadStyle(ctx, p.ID)
		if err != nil {
			return v, err
		}
		v.Bots = append(v.Bots, BotSettings{p.ID, p.Name, style})
	}
	return v, nil
}
func (s Settings) UpdateLimits(ctx context.Context, user int64, limits Limits) error {
	if err := s.authorize(ctx, user); err != nil {
		return err
	}
	if !limits.Valid() {
		return ErrInvalidSettings
	}
	return s.store.SaveLimits(ctx, limits)
}
func (s Settings) UpdateStyle(ctx context.Context, user int64, id string, style Style) error {
	if err := s.authorize(ctx, user); err != nil {
		return err
	}
	if !domain.KnownBot(id) || !style.Valid() {
		return ErrInvalidSettings
	}
	return s.store.SaveStyle(ctx, id, style)
}

// Styles exposes the bot-owned appearance to the composition root.
type Styles struct {
	store interface {
		ReadStyle(context.Context, string) (Style, error)
	}
}

func NewStyles(store interface {
	ReadStyle(context.Context, string) (Style, error)
}) Styles {
	return Styles{store}
}
func (s Styles) Read(ctx context.Context, id string) (Style, error) {
	return s.store.ReadStyle(ctx, id)
}
