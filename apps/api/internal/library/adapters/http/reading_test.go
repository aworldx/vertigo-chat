package http

import (
	"chat/api/internal/library/application"
	"chat/api/internal/library/domain"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadingMutationBoundaries(t *testing.T) {
	for _, tc := range []struct {
		path, body string
		identity   int
		err        error
		want       int
	}{
		{"/api/v1/library/1/like", `{"active":true}`, 0, nil, 200},
		{"/api/v1/library/1/bookmark", `{"active":false}`, 0, nil, 200},
		{"/api/v1/library/1/like", `{}`, 0, nil, 422},
		{"/api/v1/library/1/like", `{"active":true,"user_id":9}`, 0, nil, 422},
		{"/api/v1/library/bad/bookmark", `{"active":true}`, 0, nil, 404},
		{"/api/v1/library/1/bookmark", `{"active":true}`, 401, nil, 401},
		{"/api/v1/library/1/like", `{"active":true}`, 403, nil, 403},
		{"/api/v1/library/1/like", `{"active":true}`, 0, domain.ErrNotFound, 404},
		{"/api/v1/library/series", `{"original_name":"Old","name":"New","description":"Text"}`, 0, nil, 200},
		{"/api/v1/library/series", `{"original_name":"Old","name":"New","description":"Text"}`, 0, domain.ErrSeriesConflict, 409},
		{"/api/v1/library/series", `{"original_name":"Old","name":"","description":"Text"}`, 0, nil, 422},
		{"/api/v1/library/series", `{"original_name":"Old","name":"New","description":"Text"}`, 403, nil, 403},
	} {
		t.Run(tc.path+tc.body, func(t *testing.T) {
			mux := http.NewServeMux()
			NewHandler(application.NewService(libraryStore{tc.err}, libraryPeople{}), func(_ *http.Request, write bool) (int64, int) {
				if !write {
					t.Error("write identity required")
				}
				return 1, tc.identity
			}).Register(mux)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("PUT", tc.path, strings.NewReader(tc.body)))
			if w.Code != tc.want {
				t.Fatal(w.Code, w.Body)
			}
		})
	}
}
func TestImageUploadRequiresIdentityAndValidFile(t *testing.T) {
	for _, status := range []int{401, 403, 0} {
		mux := http.NewServeMux()
		NewHandler(application.NewService(libraryStore{}, libraryPeople{}), func(_ *http.Request, write bool) (int64, int) {
			if !write {
				t.Error("write identity required")
			}
			return 1, status
		}).Register(mux)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/v1/library/images", strings.NewReader("bad")))
		want := status
		if want == 0 {
			want = 422
		}
		if w.Code != want {
			t.Fatal(w.Code, w.Body)
		}
	}
}
