package postgres

import (
	"chat/api/internal/bot/domain"
	"context"
	"github.com/jackc/pgx/v5"
	"time"
)

func (s Store) Spend(ctx context.Context, generate func() (domain.Result, error)) error {
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	// Only background workers wait here; requests remain in their bounded queue.
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(8420931)`); err != nil {
		return err
	}
	defer func() {
		unlock, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlock, `SELECT pg_advisory_unlock(8420931)`)
	}()
	date := time.Now().UTC().Add(time.Duration(s.offset) * time.Minute).Format("2006-01-02")
	var total int
	if err := conn.QueryRow(ctx, `SELECT COALESCE((SELECT total_tokens FROM bot_daily_usages WHERE usage_date=$1),0)`, date).Scan(&total); err != nil {
		return err
	}
	if s.limit > 0 && total >= s.threshold() {
		return domain.ErrUnavailable
	}
	result, err := generate()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error { return recordUsage(ctx, tx, date, result) })
}
func (s Store) WithWarningPercent(percent int) Store {
	s.warning = 90
	if percent > 0 && percent <= 100 {
		s.warning = percent
	}
	return s
}
func (s Store) threshold() int {
	percent := s.warning
	if percent <= 0 {
		percent = 90
	}
	return (s.limit*percent + 99) / 100
}

func (s Store) Available(ctx context.Context) bool {
	if s.limit <= 0 {
		return true
	}
	date := time.Now().UTC().Add(time.Duration(s.offset) * time.Minute).Format("2006-01-02")
	var total int
	err := s.pool.QueryRow(ctx, `SELECT COALESCE((SELECT total_tokens FROM bot_daily_usages WHERE usage_date=$1),0)`, date).Scan(&total)
	return err == nil && total < s.threshold()
}
