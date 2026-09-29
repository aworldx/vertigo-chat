package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

const HistoryPageSize = 100

var ErrInvalidPeriod = errors.New("invalid history period")
var HistoryZone = time.FixedZone("Europe/Moscow", 3*60*60)

type HistoryStore interface {
	History(context.Context, string, time.Time, time.Time, int64, int, domain.HistoryFilters) ([]domain.Message, error)
	Prune(context.Context, time.Time) error
}
type History struct{ store HistoryStore }

func NewHistory(store HistoryStore) History { return History{store} }

// HistoryCutoff subtracts three calendar months, clamping the day to that month.
func HistoryCutoff(now time.Time) time.Time {
	now = now.UTC()
	month := time.Date(now.Year(), now.Month()-3, 1, now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), time.UTC)
	day := min(now.Day(), month.AddDate(0, 1, -1).Day())
	return month.AddDate(0, 0, day-1)
}
func (h History) List(ctx context.Context, room, from, through string, after int64, now time.Time, filters domain.HistoryFilters) ([]domain.Message, error) {
	filters.Author = strings.TrimSpace(filters.Author)
	filters.Recipient = strings.TrimSpace(filters.Recipient)
	if utf8.RuneCountInString(filters.Author) > 24 || utf8.RuneCountInString(filters.Recipient) > 24 {
		return nil, ErrInvalidPeriod
	}
	start, _, e1 := historyBoundary(from)
	end, precision, e2 := historyBoundary(through)
	end = end.Add(precision)
	if e1 != nil || e2 != nil || !start.Before(end) || after < 0 {
		return nil, ErrInvalidPeriod
	}
	cutoff := HistoryCutoff(now)
	if start.Before(cutoff) {
		start = cutoff
	}
	if end.After(now) {
		end = now
	}
	if !start.Before(end) {
		return []domain.Message{}, nil
	}
	return h.store.History(ctx, room, start.UTC(), end.UTC(), after, HistoryPageSize+1, filters)
}

// Minute boundaries include the entire selected minute; legacy dates include the day.
func historyBoundary(value string) (time.Time, time.Duration, error) {
	layout, precision := "2006-01-02T15:04", time.Minute
	if len(value) == len("2006-01-02") {
		layout, precision = "2006-01-02", 24*time.Hour
	}
	parsed, err := time.ParseInLocation(layout, value, HistoryZone)
	if err != nil || parsed.Format(layout) != value {
		return time.Time{}, 0, ErrInvalidPeriod
	}
	return parsed, precision, nil
}

func (h History) Prune(ctx context.Context, now time.Time) error {
	return h.store.Prune(ctx, HistoryCutoff(now))
}
