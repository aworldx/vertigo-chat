package observability

import (
	"fmt"
	"io"
	"time"
)

type Costs struct {
	TodayUSD, MonthUSD float64
	AsOf               time.Time
}
type costsState struct {
	configured, success bool
	value               Costs
}

func (m *Metrics) ConfigureCosts(enabled bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.costs.configured = enabled
}
func (m *Metrics) RecordCosts(value Costs, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.costs.success = err == nil
	if err == nil {
		m.costs.value = value
	}
}
func (m *Metrics) writeCosts(w io.Writer) {
	m.mu.Lock()
	state := m.costs
	m.mu.Unlock()
	enabled := 0
	if state.configured {
		enabled = 1
	}
	gauge(w, "chat_openai_costs_configured", "Whether an organization Costs admin key is configured.", enabled)
	if !state.configured {
		return
	}
	up := 0
	fresh := !state.value.AsOf.IsZero() && time.Since(state.value.AsOf) < 15*time.Minute
	if state.success && fresh {
		up = 1
	}
	gauge(w, "chat_openai_costs_read_success", "Whether the last organization Costs fetch succeeded and is less than 15 minutes old.", up)
	if !state.value.AsOf.IsZero() {
		_, _ = fmt.Fprintf(w, "# HELP chat_openai_costs_last_success_timestamp_seconds Last successful organization Costs fetch.\n# TYPE chat_openai_costs_last_success_timestamp_seconds gauge\nchat_openai_costs_last_success_timestamp_seconds %d\n", state.value.AsOf.Unix())
	}
	if up == 0 {
		return
	}
	// Do not present the previous UTC day's costs as today's before the next poll.
	if state.value.AsOf.UTC().Format("2006-01-02") != time.Now().UTC().Format("2006-01-02") {
		return
	}
	_, _ = fmt.Fprintf(w, "# HELP chat_openai_costs_usd Organization costs reported by OpenAI, with UTC day/month boundaries.\n# TYPE chat_openai_costs_usd gauge\nchat_openai_costs_usd{period=\"today\"} %g\nchat_openai_costs_usd{period=\"month\"} %g\n", state.value.TodayUSD, state.value.MonthUSD)
}
