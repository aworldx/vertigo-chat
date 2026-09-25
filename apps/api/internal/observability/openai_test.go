package observability

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func scrape(t *testing.T, m *Metrics) string {
	t.Helper()
	mux := http.NewServeMux()
	m.Register(mux, "secret")
	req := httptest.NewRequest("GET", "/internal/metrics", nil)
	req.Header.Set("Authorization", "Bearer secret")
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, req)
	if response.Code != 200 {
		t.Fatal(response.Code)
	}
	return response.Body.String()
}
func TestOpenAIOutcomesAreBoundedAndConcurrent(t *testing.T) {
	m := NewMetrics()
	observe := m.OpenAIObserver("hitchcock")
	m.OpenAIObserver("karmik")
	m.OpenAIObserver("claire")(200, nil)
	cases := []struct {
		status  int
		err     error
		outcome string
	}{
		{200, nil, "success"}, {429, errors.New("private provider detail"), "http_429"}, {401, errors.New("secret"), "http_4xx"},
		{503, errors.New("upstream"), "http_5xx"}, {200, errors.New("bad json"), "invalid_response"}, {0, context.DeadlineExceeded, "timeout"},
		{0, context.Canceled, "canceled"}, {0, errors.New("network"), "transport_error"}, {302, nil, "http_other"},
	}
	var group sync.WaitGroup
	for _, c := range cases {
		group.Add(1)
		go func() { defer group.Done(); observe(c.status, c.err) }()
	}
	group.Wait()
	body := scrape(t, m)
	for _, c := range cases {
		if !strings.Contains(body, `chat_openai_requests_total{bot="hitchcock",outcome="`+c.outcome+`"} 1`) {
			t.Fatal(body)
		}
	}
	if !strings.Contains(body, `chat_openai_requests_total{bot="claire",outcome="success"} 1`) || !strings.Contains(body, `chat_openai_requests_total{bot="karmik",outcome="success"} 0`) || strings.Contains(body, "private provider detail") {
		t.Fatal(body)
	}
}
func TestBudgetUnavailableIsNotReportedAsZeroUsage(t *testing.T) {
	m := NewMetrics()
	m.WithBudget(func(context.Context) (Budget, error) {
		return Budget{Limit: 100, Used: 90, StopThreshold: 90, Remaining: 10, Available: 0}, nil
	})
	body := scrape(t, m)
	for _, value := range []string{"chat_openai_daily_token_limit 100", "chat_openai_daily_tokens_used 90", "chat_openai_daily_tokens_remaining 10", "chat_openai_daily_tokens_available 0"} {
		if !strings.Contains(body, value) {
			t.Fatal(body)
		}
	}
	m.WithBudget(func(context.Context) (Budget, error) { return Budget{}, errors.New("database unavailable") })
	body = scrape(t, m)
	if !strings.Contains(body, "chat_openai_budget_read_success 0") || strings.Contains(body, "chat_openai_daily_tokens_used") {
		t.Fatal(body)
	}
	m.WithBudget(func(context.Context) (Budget, error) { return Budget{Used: 123}, nil })
	body = scrape(t, m)
	if !strings.Contains(body, "chat_openai_daily_limit_enabled 0") || strings.Contains(body, "chat_openai_daily_tokens_remaining") {
		t.Fatal(body)
	}
}
