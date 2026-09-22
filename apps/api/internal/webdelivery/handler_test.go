package webdelivery

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestOnlyPublicPagesAndFilesAreServed(t *testing.T) {
	mux := http.NewServeMux()
	files := fstest.MapFS{"index.html": {Data: []byte("React")}, "assets/app.js": {Data: []byte("bundle")}, "private.txt": {Data: []byte("secret")}}
	if err := Register(mux, files, "https://chat.test"); err != nil {
		t.Fatal(err)
	}
	for path, status := range map[string]int{"/account/login": 200, "/account/register": 200, "/profiles": 200, "/assets/app.js": 200, "/": 200, "/chat": 200, "/api/v1/missing": 404, "/assets/": 404, "/private.txt": 404, "/profiles/missing": 404} {
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code != status {
			t.Errorf("%s status=%d", path, response.Code)
		}
	}
}
