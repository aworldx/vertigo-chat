package observability

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestCostsHideUnavailableAndStaleAmounts(t *testing.T) {
	m := NewMetrics()
	if body := scrape(t, m); !strings.Contains(body, "chat_openai_costs_configured 0") || strings.Contains(body, "chat_openai_costs_usd{") {
		t.Fatal(body)
	}
	m.ConfigureCosts(true)
	m.RecordCosts(Costs{TodayUSD: 1.25, MonthUSD: 10, AsOf: time.Now()}, nil)
	if body := scrape(t, m); !strings.Contains(body, `chat_openai_costs_usd{period="today"} 1.25`) {
		t.Fatal(body)
	}
	m.RecordCosts(Costs{}, errors.New("forbidden"))
	if body := scrape(t, m); strings.Contains(body, "chat_openai_costs_usd{") || !strings.Contains(body, "chat_openai_costs_last_success_timestamp_seconds") {
		t.Fatal(body)
	}
	m.RecordCosts(Costs{TodayUSD: 1, AsOf: time.Now().Add(-time.Hour)}, nil)
	if body := scrape(t, m); strings.Contains(body, "chat_openai_costs_usd{") || !strings.Contains(body, "chat_openai_costs_read_success 0") {
		t.Fatal(body)
	}
}
