package domain

import (
	"strings"
	"testing"
)

func TestMoodUsesLocalCalendarAndHandlesInvalidDates(t *testing.T) {
	if Mood("invalid") != "" {
		t.Fatal("invalid date produced instructions")
	}
	if !strings.Contains(Mood("2026-08-13"), "Сегодня праздник") {
		t.Fatal("birthday mood missing")
	}
	if !strings.Contains(Mood("2026-08-14"), "Сегодня ты в отличном настроении") {
		t.Fatal("ordinary day mood missing")
	}
	if !strings.Contains(Mood("2026-01-01"), "Местная дата: 2026-01-01") {
		t.Fatal("local date missing")
	}
	if (RateLimited{}).Error() != "bot provider rate limited" {
		t.Fatal("unstable rate-limit error")
	}
}
