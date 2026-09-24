package domain

import (
	"testing"
	"time"
)

func TestAggregateUsesUTCDayAndMonth(t *testing.T) {
	now := time.Date(2026, 10, 1, 1, 0, 0, 0, time.FixedZone("UTC+3", 3*3600))
	buckets := []Bucket{
		{Start: time.Date(2026, 8, 31, 0, 0, 0, 0, time.UTC), USD: 100},
		{Start: time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), USD: 2},
		{Start: time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC), USD: 3},
		{Start: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), USD: 100},
	}
	value := Aggregate(buckets, now)
	if value.TodayUSD != 3 || value.MonthUSD != 5 {
		t.Fatal(value)
	}
}
