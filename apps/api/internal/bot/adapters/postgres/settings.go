package postgres

import (
	"chat/api/internal/bot/domain"
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

type settingsQuery interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (s Store) limits(ctx context.Context, db settingsQuery) (domain.Limits, error) {
	percent := s.warning
	if percent <= 0 {
		percent = 90
	}
	value := domain.Limits{DailyTokens: s.limit, StopPercent: percent}
	err := db.QueryRow(ctx, `SELECT daily_tokens,stop_percent FROM bot_settings WHERE id=true`).Scan(&value.DailyTokens, &value.StopPercent)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return value, err
}
func (s Store) ReadLimits(ctx context.Context) (domain.Limits, error) { return s.limits(ctx, s.pool) }
func (s Store) configured(ctx context.Context, db settingsQuery) (Store, error) {
	limits, err := s.limits(ctx, db)
	s.limit, s.warning = limits.DailyTokens, limits.StopPercent
	return s, err
}
func (s Store) SaveLimits(ctx context.Context, value domain.Limits) error {
	if !value.Valid() {
		return domain.ErrInvalidSettings
	}
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		// Serialize changes with spending; an already running provider call finishes first.
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(8420931)`); err != nil {
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO bot_settings(id,daily_tokens,stop_percent) VALUES(true,$1,$2) ON CONFLICT(id) DO UPDATE SET daily_tokens=$1,stop_percent=$2`, value.DailyTokens, value.StopPercent)
		return err
	})
}
func (s Store) ReadStyle(ctx context.Context, id string) (domain.Style, error) {
	v := domain.DefaultStyle()
	if !domain.KnownBot(id) {
		return v, domain.ErrInvalidSettings
	}
	err := s.pool.QueryRow(ctx, `SELECT dark_nickname,dark_text,light_nickname,light_text,font,font_style FROM bot_styles WHERE bot_id=$1`, id).Scan(&v.Dark.Nickname, &v.Dark.Text, &v.Light.Nickname, &v.Light.Text, &v.Font, &v.FontStyle)
	if errors.Is(err, pgx.ErrNoRows) {
		err = nil
	}
	return v.Normalize(), err
}
func (s Store) SaveStyle(ctx context.Context, id string, v domain.Style) error {
	if !domain.KnownBot(id) || !v.Valid() {
		return domain.ErrInvalidSettings
	}
	v = v.Normalize()
	_, err := s.pool.Exec(ctx, `INSERT INTO bot_styles(bot_id,dark_nickname,dark_text,light_nickname,light_text,font,font_style) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(bot_id) DO UPDATE SET dark_nickname=$2,dark_text=$3,light_nickname=$4,light_text=$5,font=$6,font_style=$7`, id, v.Dark.Nickname, v.Dark.Text, v.Light.Nickname, v.Light.Text, v.Font, v.FontStyle)
	return err
}
