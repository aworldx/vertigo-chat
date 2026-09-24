package openai

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCostsPaginationAndAdminCredentials(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer admin-test" || r.Header.Get("OpenAI-Organization") != "org-test" || r.URL.Query().Get("bucket_width") != "1d" || r.URL.Query().Get("limit") != "31" {
			t.Error("request contract", r.URL)
		}
		if r.URL.Query().Get("page") == "" {
			_, _ = fmt.Fprint(w, `{"data":[{"start_time":1790208000,"results":[{"amount":{"value":1.25,"currency":"usd"}}]}],"has_more":true,"next_page":"second"}`)
			return
		}
		_, _ = fmt.Fprint(w, `{"data":[{"start_time":1790294400,"results":[{"amount":{"value":0.75,"currency":"usd"}},{"amount":{"value":0.1,"currency":"usd"}}]}],"has_more":false}`)
	}))
	defer server.Close()
	client := NewClient("admin-test", "org-test")
	client.Endpoint = server.URL
	result, err := client.Read(context.Background(), time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC), time.Date(2026, 9, 25, 0, 0, 0, 0, time.UTC))
	if err != nil || calls != 2 || len(result) != 2 || result[0].USD != 1.25 || result[1].USD != 0.85 {
		t.Fatal(result, err, calls)
	}
}
func TestCostsRejectIncompleteOrInvalidResults(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
	}{
		{"missing data", 200, `{}`}, {"currency", 200, `{"data":[{"results":[{"amount":{"value":1,"currency":"eur"}}]}]}`},
		{"missing amount", 200, `{"data":[{"results":[{"amount":{"currency":"usd"}}]}]}`},
		{"pagination", 200, `{"data":[],"has_more":true,"next_page":"same"}`},
		{"forbidden", 403, `sensitive provider detail`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(tc.status); _, _ = fmt.Fprint(w, tc.body) }))
			defer server.Close()
			client := NewClient("admin-test", "")
			client.Endpoint = server.URL
			result, err := client.Read(context.Background(), time.Now().Add(-time.Hour), time.Now())
			if err == nil || result != nil || strings.Contains(err.Error(), "sensitive") {
				t.Fatal(result, err)
			}
		})
	}
}
