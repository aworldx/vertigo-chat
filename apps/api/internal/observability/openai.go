package observability

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"time"
)

type Budget struct{ Limit, Used, StopThreshold, Remaining, Available int }
type openAIKey struct{ bot, outcome string }

var openAIOutcomes = []string{"success", "http_429", "http_4xx", "http_5xx", "http_other", "timeout", "canceled", "transport_error", "invalid_response"}

// WithBudget configures the read-only ledger query before the server starts.
func (m *Metrics) WithBudget(read func(context.Context) (Budget, error)) { m.budget = read }

// OpenAIObserver counts individual outgoing attempts, including retries and memory summaries.
// Only bounded labels are exported; error text, prompts and credentials never are.
func (m *Metrics) OpenAIObserver(bot string) func(int, error) {
	if bot != "hitchcock" && bot != "karmik" && bot != "claire" {
		panic("unknown OpenAI bot")
	}
	m.mu.Lock()
	for _, outcome := range openAIOutcomes {
		m.openai[openAIKey{bot, outcome}] += 0
	}
	m.mu.Unlock()
	return func(status int, err error) {
		outcome := openAIOutcome(status, err)
		m.mu.Lock()
		m.openai[openAIKey{bot, outcome}]++
		m.mu.Unlock()
	}
}
func openAIOutcome(status int, err error) string {
	var timeout net.Error
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, context.Canceled):
		return "canceled"
	case errors.As(err, &timeout) && timeout.Timeout():
		return "timeout"
	case status == 0:
		return "transport_error"
	case status == 429:
		return "http_429"
	case status >= 500:
		return "http_5xx"
	case status >= 400:
		return "http_4xx"
	case status != 200:
		return "http_other"
	case err != nil:
		return "invalid_response"
	default:
		return "success"
	}
}
func (m *Metrics) writeOpenAI(w io.Writer, ctx context.Context) {
	_, _ = fmt.Fprintln(w, "# HELP chat_openai_requests_total OpenAI request attempts by bot and outcome, including retries and summaries.\n# TYPE chat_openai_requests_total counter")
	m.mu.Lock()
	counts := make(map[openAIKey]uint64, len(m.openai))
	for k, v := range m.openai {
		counts[k] = v
	}
	m.mu.Unlock()
	for _, bot := range []string{"hitchcock", "karmik", "claire"} {
		for _, outcome := range openAIOutcomes {
			if count, ok := counts[openAIKey{bot, outcome}]; ok {
				_, _ = fmt.Fprintf(w, "chat_openai_requests_total{bot=%q,outcome=%q} %d\n", bot, outcome, count)
			}
		}
	}
	if m.budget == nil {
		return
	}
	readCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	budget, err := m.budget(readCtx)
	up := 1
	if err != nil {
		up = 0
	}
	gauge(w, "chat_openai_budget_read_success", "Whether the daily budget ledger was read successfully.", up)
	if err != nil {
		return
	} // Missing values must never look like a fresh, unused budget.
	gauge(w, "chat_openai_daily_tokens_used", "Tokens recorded in the shared application ledger for the current budget day.", budget.Used)
	enabled := 0
	if budget.Limit > 0 {
		enabled = 1
	}
	gauge(w, "chat_openai_daily_limit_enabled", "Whether the application daily token limit is enabled.", enabled)
	if enabled == 0 {
		return
	} // An unlimited budget is not zero tokens remaining.
	gauge(w, "chat_openai_daily_token_limit", "Configured shared daily token limit.", budget.Limit)
	gauge(w, "chat_openai_daily_tokens_remaining", "Tokens remaining to the full daily limit, clamped at zero.", budget.Remaining)
	gauge(w, "chat_openai_daily_stop_threshold", "Token threshold at which the application stops both bots.", budget.StopThreshold)
	gauge(w, "chat_openai_daily_tokens_available", "Tokens remaining until the application stops both bots, clamped at zero.", budget.Available)
}
func gauge(w io.Writer, name, help string, value int) {
	_, _ = fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n%s %d\n", name, help, name, name, value)
}
