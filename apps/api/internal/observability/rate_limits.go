package observability

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

type rateLimitKey struct{ bot, resource string }
type rateLimit struct {
	limit, remaining int64
	reset, observed  time.Time
}

var rateResources = []string{"tokens", "requests", "project-tokens"}

// OpenAIHeaders records only documented numeric rate-limit headers, not arbitrary response data.
func (m *Metrics) OpenAIHeaders(bot string) func(http.Header) {
	if bot != "hitchcock" && bot != "karmik" && bot != "claire" {
		panic("unknown OpenAI bot")
	}
	return func(headers http.Header) { m.recordHeaders(bot, headers, time.Now()) }
}
func (m *Metrics) recordHeaders(bot string, headers http.Header, now time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.rateLimits == nil {
		m.rateLimits = make(map[rateLimitKey]rateLimit)
	}
	for _, resource := range rateResources {
		key := rateLimitKey{bot, resource}
		// A response without this header must not keep an older remaining value looking current.
		delete(m.rateLimits, key)
		limit, e1 := strconv.ParseInt(headers.Get("x-ratelimit-limit-"+resource), 10, 64)
		remaining, e2 := strconv.ParseInt(headers.Get("x-ratelimit-remaining-"+resource), 10, 64)
		if e1 != nil || e2 != nil || limit < 0 || remaining < 0 {
			continue
		}
		value := rateLimit{limit: limit, remaining: remaining, observed: now}
		if reset, err := time.ParseDuration(headers.Get("x-ratelimit-reset-" + resource)); err == nil && reset >= 0 {
			value.reset = now.Add(reset)
		}
		m.rateLimits[key] = value
	}
}
func (m *Metrics) writeRateLimits(w io.Writer, now time.Time) {
	m.mu.Lock()
	values := make(map[rateLimitKey]rateLimit, len(m.rateLimits))
	for k, v := range m.rateLimits {
		values[k] = v
	}
	m.mu.Unlock()
	for _, metric := range []struct{ name, help string }{
		{"limit", "Rate-limit capacity reported by the last OpenAI response."},
		{"remaining", "Last reported remaining capacity; omitted after reset or 15 minutes without an observation."},
		{"reset_timestamp_seconds", "Reported rate-limit reset timestamp."},
		{"observed_timestamp_seconds", "Time the rate-limit headers were received."},
	} {
		_, _ = fmt.Fprintf(w, "# HELP chat_openai_rate_%s %s\n# TYPE chat_openai_rate_%s gauge\n", metric.name, metric.help, metric.name)
	}
	for _, bot := range []string{"hitchcock", "karmik", "claire"} {
		for _, resource := range rateResources {
			v, ok := values[rateLimitKey{bot, resource}]
			if !ok {
				continue
			}
			rateGauge(w, "limit", bot, resource, v.limit)
			rateGauge(w, "observed_timestamp_seconds", bot, resource, v.observed.Unix())
			if !v.reset.IsZero() {
				rateGauge(w, "reset_timestamp_seconds", bot, resource, v.reset.Unix())
			}
			if now.Sub(v.observed) < 15*time.Minute && (v.reset.IsZero() || now.Before(v.reset)) {
				rateGauge(w, "remaining", bot, resource, v.remaining)
			}
		}
	}
}
func rateGauge(w io.Writer, name, bot, resource string, value int64) {
	_, _ = fmt.Fprintf(w, "chat_openai_rate_%s{bot=%q,resource=%q} %d\n", name, bot, resource, value)
}
