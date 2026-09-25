package clientip

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTrustedProxyBoundary(t *testing.T) {
	for _, test := range []struct {
		name, peer, forwarded, want string
		status                      int
	}{
		{"first client", "172.20.0.2:1234", "198.51.100.1", "198.51.100.1:0", 200},
		{"second client", "172.20.0.2:1234", "198.51.100.2", "198.51.100.2:0", 200},
		{"direct spoof", "198.51.100.3:1234", "198.51.100.1", "198.51.100.3:1234", 200},
		{"untrusted prefix", "172.20.0.2:1234", "1.1.1.1, 198.51.100.4", "198.51.100.4:0", 200},
		{"trusted chain", "172.20.0.2:1234", "2001:db8::1, 172.20.0.2", "[2001:db8::1]:0", 200},
		{"missing", "172.20.0.2:1234", "", "", 400},
		{"malformed", "172.20.0.2:1234", "invalid", "", 400},
		{"bad peer", "invalid", "1.1.1.1", "invalid", 200},
		{"scoped", "172.20.0.2:1234", "fe80::1%eth0", "", 400},
	} {
		t.Run(test.name, func(t *testing.T) {
			next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.RemoteAddr != test.want {
					t.Errorf("peer=%s want=%s", r.RemoteAddr, test.want)
				}
				w.WriteHeader(http.StatusOK)
			})
			handler, err := Wrap(next, "172.20.0.2/32, ")
			if err != nil {
				t.Fatal(err)
			}
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = test.peer
			r.Header.Set("X-Forwarded-For", test.forwarded)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != test.status {
				t.Fatalf("status=%d", w.Code)
			}
			if r.RemoteAddr != test.peer {
				t.Fatal("original request changed")
			}
		})
	}
}

func TestProxyConfiguration(t *testing.T) {
	if _, err := Wrap(http.NotFoundHandler(), "invalid"); err == nil {
		t.Fatal("invalid CIDR accepted")
	}
	handler, err := Wrap(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		if r.RemoteAddr != "172.20.0.2:123" {
			t.Fatal("trusted proxy without configuration")
		}
	}), "")
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "172.20.0.2:123"
	r.Header.Set("X-Forwarded-For", "1.1.1.1")
	handler.ServeHTTP(httptest.NewRecorder(), r)
}
