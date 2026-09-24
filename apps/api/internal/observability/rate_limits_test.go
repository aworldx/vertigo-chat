package observability

import (
	"bytes"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestRateHeadersExpireAtResetAndNeverExposeArbitraryHeaders(t *testing.T) {
	m := NewMetrics()
	now := time.Now()
	h := http.Header{}
	h.Set("x-ratelimit-limit-tokens", "150000")
	h.Set("x-ratelimit-remaining-tokens", "149000")
	h.Set("x-ratelimit-reset-tokens", "6m0s")
	h.Set("Authorization", "secret")
	m.recordHeaders("hitchcock", h, now)
	var out bytes.Buffer
	m.writeRateLimits(&out, now)
	if !strings.Contains(out.String(), `chat_openai_rate_remaining{bot="hitchcock",resource="tokens"} 149000`) || strings.Contains(out.String(), "secret") {
		t.Fatal(out.String())
	}
	out.Reset()
	m.writeRateLimits(&out, now.Add(6*time.Minute))
	if strings.Contains(out.String(), `chat_openai_rate_remaining{`) {
		t.Fatal("stale remaining", out.String())
	}
	m.recordHeaders("hitchcock", http.Header{}, now)
	out.Reset()
	m.writeRateLimits(&out, now)
	if strings.Contains(out.String(), `bot="hitchcock"`) {
		t.Fatal("missing headers reused old snapshot")
	}
}
