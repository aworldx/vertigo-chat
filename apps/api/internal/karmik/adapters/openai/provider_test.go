package openai

import (
	"chat/api/internal/karmik/domain"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestObservesHTTPAndInvalidResponses(t *testing.T) {
	for _, tc := range []struct {
		name    string
		status  int
		body    string
		failure bool
	}{
		{"success", 200, `{"output":[{"content":[{"type":"output_text","text":"{\"assessments\":[]}"}]}],"usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}`, false},
		{"bad JSON", 200, `{`, true},
		{"bad assessment JSON", 200, `{"output":[{"content":[{"type":"output_text","text":"invalid"}]}],"usage":{"total_tokens":1}}`, true},
		{"rate limit", 429, `{}`, true}, {"unavailable", 503, `{}`, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer server.Close()
			p := NewProvider("test", "model")
			p.Endpoint = server.URL
			calls := 0
			p.Observe = func(status int, err error) {
				calls++
				if status != tc.status || (err != nil) != tc.failure {
					t.Errorf("observation: %d %v", status, err)
				}
			}
			_, _, err := p.Assess(context.Background(), domain.Input{})
			if calls != 1 || (err != nil) != tc.failure {
				t.Fatal(calls, err)
			}
		})
	}
}
