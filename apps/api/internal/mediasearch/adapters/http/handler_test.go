package http

import (
	"chat/api/internal/mediasearch/application"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type providerFunc func(context.Context, string, string) ([]application.Item, error)

func (f providerFunc) Search(ctx context.Context, kind, query string) ([]application.Item, error) {
	return f(ctx, kind, query)
}

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestSearchValidationAndAuthorization(t *testing.T) {
	for _, tc := range []struct {
		kind, query string
		deny, fail  bool
		status      int
	}{
		{"gif", "  cat  ", false, false, 200}, {"music", "song", false, false, 200}, {"youtube", "video", false, false, 200},
		{"bad", "query", false, false, 502}, {"gif", strings.Repeat("я", 81), false, false, 502}, {"music", strings.Repeat("я", 121), false, false, 502}, {"youtube", strings.Repeat("я", 201), false, false, 502}, {"gif", "", false, false, 502}, {"gif", "cat", true, false, 401}, {"gif", "cat", false, true, 502},
	} {
		t.Run(tc.kind+tc.query, func(t *testing.T) {
			calls := 0
			provider := providerFunc(func(_ context.Context, kind, query string) ([]application.Item, error) {
				calls++
				if query != strings.TrimSpace(tc.query) || kind != tc.kind {
					t.Fatal(kind, query)
				}
				if tc.fail {
					return nil, errors.New("offline")
				}
				return []application.Item{{Kind: kind, Title: query}}, nil
			})
			mux := http.NewServeMux()
			NewHandler(application.NewService(provider), func(w http.ResponseWriter, _ *http.Request) bool {
				if tc.deny {
					w.WriteHeader(401)
				}
				return !tc.deny
			}).Register(mux, "")
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, httptest.NewRequest("GET", "/api/v1/chat/media/"+tc.kind+"?q="+url.QueryEscape(tc.query), nil))
			if response.Code != tc.status {
				t.Fatal(response)
			}
			if tc.status == 200 && (calls != 1 || !strings.Contains(response.Body.String(), `"data"`)) {
				t.Fatal(response)
			}
			if tc.deny && calls != 0 {
				t.Fatal("unauthorized provider request")
			}
		})
	}
}
func TestMediaProxyBoundaries(t *testing.T) {
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	for _, tc := range []struct {
		name, kind, address, contentType string
		upstream, status                 int
		fail                             bool
	}{
		{"gif", "gif", "https://gifsnap.com/api/v1/media/1", "image/gif", 200, 200, false},
		{"music range", "music", "https://sunproxy.net/file/1", "audio/mpeg", 206, 206, false},
		{"SSRF", "gif", "http://127.0.0.1/secret", "image/gif", 200, 400, false},
		{"wrong type", "gif", "https://gifsnap.com/api/v1/media/1", "text/html", 200, 502, false},
		{"upstream failure", "gif", "https://gifsnap.com/api/v1/media/1", "image/gif", 500, 502, false},
		{"network failure", "gif", "https://gifsnap.com/api/v1/media/1", "image/gif", 200, 502, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			http.DefaultTransport = transportFunc(func(r *http.Request) (*http.Response, error) {
				calls++
				if tc.fail {
					return nil, errors.New("offline")
				}
				if r.Header.Get("Range") != "bytes=0-3" || r.Header.Get("Cookie") != "" {
					t.Fatal("unsafe forwarding")
				}
				return &http.Response{StatusCode: tc.upstream, Header: http.Header{"Content-Type": {tc.contentType}, "Content-Range": {"bytes 0-3/4"}}, Body: io.NopCloser(strings.NewReader("data"))}, nil
			})
			request := httptest.NewRequest("GET", "/proxy?url="+url.QueryEscape(tc.address), nil)
			request.Header.Set("Range", "bytes=0-3")
			request.Header.Set("Cookie", "secret=value")
			response := httptest.NewRecorder()
			proxyMedia(tc.kind)(response, request)
			if response.Code != tc.status {
				t.Fatal(response)
			}
			if tc.status == 400 && calls != 0 {
				t.Fatal("SSRF reached transport")
			}
			if tc.status < 300 && (response.Body.String() != "data" || response.Header().Get("X-Content-Type-Options") != "nosniff") {
				t.Fatal(response)
			}
		})
	}
}
func TestYoutubeProxyStripsCredentials(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") != "" || r.Header.Get("Authorization") != "" {
			t.Error("credentials leaked")
		}
		w.WriteHeader(202)
	}))
	defer upstream.Close()
	mux := http.NewServeMux()
	NewHandler(application.NewService(nil), func(http.ResponseWriter, *http.Request) bool { return true }).Register(mux, upstream.URL)
	for _, tc := range []struct {
		id     string
		status int
	}{{"abcdefghijk", 202}, {"bad", 404}} {
		r := httptest.NewRequest("GET", "/youtube-proxy/"+tc.id, nil)
		r.Header.Set("Cookie", "secret=value")
		r.Header.Set("Authorization", "Bearer private")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatal(w)
		}
	}
}
