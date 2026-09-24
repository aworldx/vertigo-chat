package main

import (
	"chat/api/internal/observability"
	"context"
	"io"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"
)

type costsTransport func(*http.Request) (*http.Response, error)

func (f costsTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestCostsPollingPublishesResultsAndStopsOnCancellation(t *testing.T) {
	t.Setenv("OPENAI_COSTS_ADMIN_KEY", "test-admin-key")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	synctest.Test(t, func(t *testing.T) {
		var calls atomic.Int32
		http.DefaultTransport = costsTransport(func(r *http.Request) (*http.Response, error) {
			call := calls.Add(1)
			if r.URL.Host != "api.openai.com" || r.URL.Path != "/v1/organization/costs" {
				t.Error("unexpected costs request")
			}
			status, body := 200, `{"data":[],"has_more":false}`
			if call > 1 {
				status, body = 503, `{}`
			}
			return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body))}, nil
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		done := make(chan struct{})
		go func() { runOpenAICosts(ctx, observability.NewMetrics()); close(done) }()
		synctest.Wait()
		if calls.Load() != 1 {
			t.Fatal(calls.Load())
		}
		time.Sleep(5 * time.Minute)
		synctest.Wait()
		if calls.Load() != 2 {
			t.Fatal(calls.Load())
		}
		cancel()
		synctest.Wait()
		<-done
	})
}
