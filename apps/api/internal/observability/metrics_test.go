package observability

import (
	"bufio"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var _ http.Hijacker = (*responseWriter)(nil)
var _ http.Flusher = (*responseWriter)(nil)

type upgradeWriter struct{ *httptest.ResponseRecorder }

func (upgradeWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) { return nil, nil, nil }
func (upgradeWriter) Flush()                                       {}

func TestMetricsRequireBearerTokenAndExposeAggregateHTTPOutcomes(t *testing.T) {
	mux := http.NewServeMux()
	metrics := NewMetrics()
	metrics.Register(mux, "secret")
	mux.HandleFunc("GET /ok", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("GET /broken", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusInternalServerError) })
	handler := metrics.Wrap(mux)
	for _, path := range []string{"/ok", "/broken"} {
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
	}
	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/internal/metrics", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d", unauthorized.Code)
	}
	authorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/internal/metrics", nil)
	request.Header.Set("Authorization", "Bearer secret")
	handler.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusOK {
		t.Fatalf("authorized status = %d", authorized.Code)
	}
	body := authorized.Body.String()
	for _, expected := range []string{"chat_http_requests_total{status_class=\"2xx\"} 1", "chat_http_requests_total{status_class=\"5xx\"} 1", "chat_http_requests_5xx_total 1"} {
		if !strings.Contains(body, expected) {
			t.Errorf("metrics do not contain %q:\n%s", expected, body)
		}
	}
}

func TestMetricsPreserveWebSocketUpgradeInterfaces(t *testing.T) {
	wrapped := &responseWriter{ResponseWriter: upgradeWriter{httptest.NewRecorder()}, status: http.StatusOK}
	if _, _, err := wrapped.Hijack(); err != nil {
		t.Fatal(err)
	}
	wrapped.Flush()
}
