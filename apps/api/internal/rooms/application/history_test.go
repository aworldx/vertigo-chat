package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"testing"
	"time"
)

type historySpy struct {
	start, end, cutoff time.Time
	after              int64
	limit              int
	calls              int
	err                error
}

func (s *historySpy) History(_ context.Context, _ string, start, end time.Time, after int64, limit int) ([]domain.Message, error) {
	s.start = start
	s.end = end
	s.after = after
	s.limit = limit
	s.calls++
	return []domain.Message{}, s.err
}
func (s *historySpy) Prune(_ context.Context, cutoff time.Time) error {
	s.cutoff = cutoff
	return s.err
}
func TestHistoryPeriod(t *testing.T) {
	s := &historySpy{}
	h := NewHistory(s)
	now := time.Date(2026, 5, 31, 12, 0, 0, 0, time.UTC)
	if got := HistoryCutoff(now); got.Format(time.RFC3339) != "2026-02-28T12:00:00Z" {
		t.Fatal(got)
	}
	if got := HistoryCutoff(time.Date(2024, 5, 31, 12, 0, 0, 0, time.UTC)); got.Day() != 29 {
		t.Fatal(got)
	}
	for _, period := range [][2]string{{"", ""}, {"2026-02-30", "2026-03-01"}, {"2026-04-02", "2026-04-01"}} {
		if _, err := h.List(context.Background(), "lobby", period[0], period[1], 0, now); !errors.Is(err, ErrInvalidPeriod) {
			t.Fatal(err)
		}
	}
	if _, err := h.List(context.Background(), "lobby", "2026-04-01", "2026-04-01", -1, now); !errors.Is(err, ErrInvalidPeriod) {
		t.Fatal(err)
	}
}
func TestHistoryMoscowDatesAndWindow(t *testing.T) {
	s := &historySpy{}
	h := NewHistory(s)
	now := time.Date(2026, 5, 31, 12, 0, 0, 0, time.UTC)
	if _, err := h.List(context.Background(), "lobby", "2026-04-01", "2026-04-01", 12, now); err != nil {
		t.Fatal(err)
	}
	if s.start.Format(time.RFC3339) != "2026-03-31T21:00:00Z" || s.end.Format(time.RFC3339) != "2026-04-01T21:00:00Z" || s.after != 12 || s.limit != 101 {
		t.Fatal(s)
	}
	if _, err := h.List(context.Background(), "lobby", "2020-01-01", "2026-06-01", 0, now); err != nil {
		t.Fatal(err)
	}
	if !s.start.Equal(HistoryCutoff(now)) || !s.end.Equal(now) {
		t.Fatal(s)
	}
}
func TestHistoryEmptyPeriodsAndFailures(t *testing.T) {
	s := &historySpy{}
	h := NewHistory(s)
	now := time.Date(2026, 5, 31, 12, 0, 0, 0, time.UTC)
	calls := s.calls
	for _, date := range []string{"2020-01-01", "2027-01-01"} {
		values, err := h.List(context.Background(), "lobby", date, date, 0, now)
		if err != nil || len(values) != 0 || s.calls != calls {
			t.Fatal(values, err)
		}
	}
	if err := h.Prune(context.Background(), now); err != nil || !s.cutoff.Equal(HistoryCutoff(now)) {
		t.Fatal(s, err)
	}
	s.err = errors.New("database")
	if _, err := h.List(context.Background(), "lobby", "2026-04-01", "2026-04-01", 0, now); err == nil {
		t.Fatal("missing error")
	}
}
