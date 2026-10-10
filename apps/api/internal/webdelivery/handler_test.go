package webdelivery

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestOnlyPublicPagesAndFilesAreServed(t *testing.T) {
	mux := http.NewServeMux()
	files := fstest.MapFS{"index.html": {Data: []byte("React")}, "assets/app.js": {Data: []byte("bundle")}, "private.txt": {Data: []byte("secret")}}
	if err := Register(mux, files, "https://chat.test"); err != nil {
		t.Fatal(err)
	}
	for path, status := range map[string]int{"/account": 200, "/account/login": 200, "/account/register": 200, "/profiles": 200, "/notes": 200, "/polls": 200, "/visits": 200, "/history": 200, "/help": 200, "/ranks": 200, "/rankings": 200, "/games": 404, "/assets/app.js": 200, "/": 200, "/chat": 200, "/api/v1/missing": 404, "/assets/": 404, "/private.txt": 404, "/profiles/missing": 404} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if (path == "/notes" || path == "/polls" || path == "/visits" || path == "/history") && response.Header().Get("X-Robots-Tag") != "noindex, nofollow" {
			t.Fatal("private page must not be indexed")
		}
		if response.Code != status {
			t.Errorf("%s status=%d", path, response.Code)
		}
	}
}

func TestGoogleVerificationFile(t *testing.T) {
	const name = "google10f6b43daaaddcce.html"
	const want = "google-site-verification: " + name
	mux := http.NewServeMux()
	if err := Register(mux, fstest.MapFS{
		"index.html":        {Data: []byte("React")},
		name:                {Data: []byte(want)},
		"google-other.html": {Data: []byte("not public")},
	}, "https://chat.test"); err != nil {
		t.Fatal(err)
	}
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(method, "/"+name, nil))
		if response.Code != http.StatusOK || !strings.HasPrefix(response.Header().Get("Content-Type"), "text/html") {
			t.Fatalf("%s: status=%d headers=%v", method, response.Code, response.Header())
		}
		if method == http.MethodGet && response.Body.String() != want {
			t.Fatalf("unexpected verification response: %q", response.Body.String())
		}
	}
	for _, path := range []string{"/google-other.html", "/" + name + "/extra"} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
		if response.Code != http.StatusNotFound {
			t.Fatalf("%s: status=%d", path, response.Code)
		}
	}
}
