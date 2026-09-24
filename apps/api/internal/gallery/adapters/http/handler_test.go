package http

import (
	"chat/api/internal/gallery/application"
	"chat/api/internal/gallery/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type galleryStore struct{ err error }

func (s galleryStore) List(context.Context, int64) ([]domain.Photo, error)      { return nil, s.err }
func (s galleryStore) Add(context.Context, int64, domain.Upload) (int64, error) { return 1, s.err }
func (s galleryStore) Caption(context.Context, int64, int64, string) error      { return s.err }
func (s galleryStore) Like(context.Context, int64, int64, bool) error           { return s.err }
func (s galleryStore) Media(context.Context, int64, bool) (domain.Media, error) {
	return domain.Media{}, s.err
}

type galleryPeople struct{ err error }

func (s galleryPeople) Viewer(context.Context, int64) (application.Viewer, error) {
	return application.Viewer{}, s.err
}
func (s galleryPeople) Names(context.Context, []int64) (map[int64]string, error) { return nil, s.err }
func TestGalleryHTTPFailureBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, method, path, body string
		identity, status         int
		storeErr, peopleErr      error
	}{
		{name: "identity unavailable", method: "GET", path: "/api/v1/gallery", identity: 503, status: 503},
		{name: "viewer unavailable", method: "GET", path: "/api/v1/gallery", peopleErr: errors.New("offline"), status: 503},
		{name: "store unavailable", method: "GET", path: "/api/v1/gallery", storeErr: errors.New("offline"), status: 503},
		{name: "unauthorized caption", method: "PUT", path: "/api/v1/gallery/1/caption", identity: 401, status: 401},
		{name: "bad caption ID", method: "PUT", path: "/api/v1/gallery/bad/caption", status: 404},
		{name: "caption required", method: "PUT", path: "/api/v1/gallery/1/caption", body: `{}`, status: 422},
		{name: "unknown field", method: "PUT", path: "/api/v1/gallery/1/caption", body: `{"user_id":2}`, status: 422},
		{name: "trailing JSON", method: "PUT", path: "/api/v1/gallery/1/caption", body: `{"caption":"x"} {}`, status: 422},
		{name: "caption ownership", method: "PUT", path: "/api/v1/gallery/1/caption", body: `{"caption":"x"}`, storeErr: domain.ErrForbidden, status: 403},
		{name: "unauthorized like", method: "PUT", path: "/api/v1/gallery/1/like", identity: 401, status: 401},
		{name: "active required", method: "PUT", path: "/api/v1/gallery/1/like", body: `{}`, status: 422},
		{name: "like ownership", method: "PUT", path: "/api/v1/gallery/1/like", body: `{"active":true}`, storeErr: domain.ErrForbidden, status: 403},
		{name: "bad media ID", method: "GET", path: "/gallery/photos/bad", status: 404},
		{name: "media missing", method: "GET", path: "/gallery/photos/1", storeErr: domain.ErrNotFound, status: 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			NewHandler(application.NewService(galleryStore{tc.storeErr}, galleryPeople{tc.peopleErr}), func(*http.Request, bool) (int64, int) { return 1, tc.identity }).Register(mux)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
			if w.Code != tc.status {
				t.Fatal(w.Code, w.Body)
			}
		})
	}
}
