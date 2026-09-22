package webdelivery

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestLoopbackPageCanonicalOrigin(t *testing.T) {
	for _, test := range []struct {
		name, origin, method, target, location string
		status                                 int
	}{
		{"localhost", "http://127.0.0.1:4040", "GET", "http://localhost:4040/?q=test", "http://127.0.0.1:4040/?q=test", 307},
		{"chat", "http://127.0.0.1:4040", "GET", "http://localhost:4040/chat", "http://127.0.0.1:4040/chat", 307},
		{"reverse_alias", "http://localhost:4040", "HEAD", "http://127.0.0.1:4040/profiles", "http://localhost:4040/profiles", 307},
		{"canonical", "http://127.0.0.1:4040", "GET", "http://127.0.0.1:4040/", "", 200},
		{"different_port", "http://127.0.0.1:4040", "GET", "http://localhost:4041/", "", 200},
		{"other_host", "http://127.0.0.1:4040", "GET", "http://evil.test:4040/", "", 200},
		{"production", "https://chat.test", "GET", "http://localhost:4040/", "", 200},
		{"api", "http://127.0.0.1:4040", "GET", "http://localhost:4040/api/v1/auth/session", "", 404},
		{"mutation", "http://127.0.0.1:4040", "POST", "http://localhost:4040/", "", 405},
	} {
		t.Run(test.name, func(t *testing.T) {
			mux := http.NewServeMux()
			if err := Register(mux, fstest.MapFS{"index.html": {Data: []byte("React")}}, test.origin); err != nil {
				t.Fatal(err)
			}
			response := httptest.NewRecorder()
			mux.ServeHTTP(response, httptest.NewRequest(test.method, test.target, nil))
			if response.Code != test.status || response.Header().Get("Location") != test.location {
				t.Fatalf("status %d, location %q", response.Code, response.Header().Get("Location"))
			}
		})
	}
}
