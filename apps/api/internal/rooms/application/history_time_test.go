package application

import (
	"chat/api/internal/rooms/domain"
	"context"
	"errors"
	"testing"
	"time"
)

func TestHistoryMinuteBoundariesInMoscow(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 30, 15, 0, time.UTC)
	for _, tc := range []struct{ from, through, start, end string }{
		{"2026-09-28T10:15", "2026-09-28T10:15", "2026-09-28T07:15:00Z", "2026-09-28T07:16:00Z"},
		{"2026-09-28T23:59", "2026-09-29T00:00", "2026-09-28T20:59:00Z", "2026-09-28T21:01:00Z"},
		{"2026-09-28T10:15", "2026-09-28", "2026-09-28T07:15:00Z", "2026-09-28T21:00:00Z"},
		{"2026-09-29", "2026-09-29T15:30", "2026-09-28T21:00:00Z", "2026-09-29T12:30:15Z"},
		{"2026-01-01T00:00", "2026-09-29T23:59", "2026-06-29T12:30:15Z", "2026-09-29T12:30:15Z"},
	} {
		s := &historySpy{}
		_, err := NewHistory(s).List(context.Background(), "lobby", tc.from, tc.through, 17, now, domain.HistoryFilters{Author: "Автор", Recipient: "Кому"})
		if err != nil || s.start.Format(time.RFC3339) != tc.start || s.end.Format(time.RFC3339) != tc.end || s.after != 17 || s.filters.Author != "Автор" || s.filters.Recipient != "Кому" {
			t.Fatalf("%+v: %+v, %v", tc, s, err)
		}
	}
}

func TestHistoryRejectsInvalidTimes(t *testing.T) {
	now := time.Date(2026, 9, 29, 12, 0, 0, 0, time.UTC)
	for _, period := range [][2]string{
		{"2026-09-28T10:16", "2026-09-28T10:15"},
		{"2026-09-28T24:00", "2026-09-29T00:00"},
		{"2026-09-28T10:00", "2026-09-28T10:60"},
		{"2026-09-28T10:00Z", "2026-09-29T00:00"},
		{"2026-09-28T10:00+03:00", "2026-09-29T00:00"},
		{"2026-09-28T10:00:01", "2026-09-29T00:00"},
		{"2026-09-28T1:00", "2026-09-29T00:00"},
		{"2026-09-31T10:00", "2026-10-01T00:00"},
	} {
		s := &historySpy{}
		_, err := NewHistory(s).List(context.Background(), "lobby", period[0], period[1], 0, now, domain.HistoryFilters{})
		if !errors.Is(err, ErrInvalidPeriod) || s.calls != 0 {
			t.Fatalf("%v: %v, %d store calls", period, err, s.calls)
		}
	}
}
