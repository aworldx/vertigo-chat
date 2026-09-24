// Package observability exposes small, dependency-free operational metrics.
package observability

import (
	"bufio"
	"context"
	"crypto/subtle"
	"fmt"
	"net"
	"net/http"
	"sort"
	"sync"
	"time"
)

// Metrics records aggregate HTTP outcomes. It deliberately does not retain
// request paths or identities, so scraping cannot create unbounded series or
// reveal user data.
type Metrics struct {
	rateLimits map[rateLimitKey]rateLimit
	costs      costsState
	mu         sync.Mutex
	classes    map[string]uint64
	openai     map[openAIKey]uint64
	budget     func(context.Context) (Budget, error)
}

func NewMetrics() *Metrics {
	return &Metrics{classes: make(map[string]uint64), openai: make(map[openAIKey]uint64)}
}

func (m *Metrics) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		m.mu.Lock()
		m.classes[fmt.Sprintf("%dxx", recorder.status/100)]++
		m.mu.Unlock()
	})
}

// Register adds a private Prometheus scrape endpoint. An empty token disables
// the endpoint rather than accidentally publishing application activity.
func (m *Metrics) Register(mux *http.ServeMux, token string) {
	mux.HandleFunc("GET /internal/metrics", func(w http.ResponseWriter, r *http.Request) {
		if token == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+token)) != 1 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		m.mu.Lock()
		classes := make(map[string]uint64, len(m.classes))
		for class, count := range m.classes {
			classes[class] = count
		}
		m.mu.Unlock()
		keys := make([]string, 0, len(classes))
		for class := range classes {
			keys = append(keys, class)
		}
		sort.Strings(keys)
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		_, _ = fmt.Fprintln(w, "# HELP chat_http_requests_total HTTP responses by status class.")
		_, _ = fmt.Fprintln(w, "# TYPE chat_http_requests_total counter")
		for _, class := range keys {
			_, _ = fmt.Fprintf(w, "chat_http_requests_total{status_class=%q} %d\n", class, classes[class])
		}
		_, _ = fmt.Fprintln(w, "# HELP chat_http_requests_5xx_total HTTP server errors.")
		_, _ = fmt.Fprintln(w, "# TYPE chat_http_requests_5xx_total counter")
		_, _ = fmt.Fprintf(w, "chat_http_requests_5xx_total %d\n", classes["5xx"])
		m.writeOpenAI(w, r.Context())
		m.writeCosts(w)
		m.writeRateLimits(w, time.Now())
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (w *responseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseWriter) Write(data []byte) (int, error) { return w.ResponseWriter.Write(data) }

// Hijack and Flush preserve WebSocket upgrades and streaming handlers wrapped
// by Metrics. net/http detects these capabilities through type assertions.
func (w *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.ResponseWriter.(http.Hijacker).Hijack()
}

func (w *responseWriter) Flush() { w.ResponseWriter.(http.Flusher).Flush() }

func (w *responseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
