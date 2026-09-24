package domain

import "time"

type Bucket struct {
	Start time.Time
	USD   float64
}
type Costs struct {
	TodayUSD, MonthUSD float64
	AsOf               time.Time
}

func Aggregate(buckets []Bucket, now time.Time) Costs {
	now = now.UTC()
	day := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	result := Costs{AsOf: now}
	for _, b := range buckets {
		if b.Start.Before(month) || b.Start.After(now) {
			continue
		}
		result.MonthUSD += b.USD
		if !b.Start.Before(day) {
			result.TodayUSD += b.USD
		}
	}
	return result
}
