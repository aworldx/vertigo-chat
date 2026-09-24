package http

import (
	"chat/api/internal/library/application"
	"chat/api/internal/library/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type libraryStore struct{ err error }

func (s libraryStore) List(context.Context, int64, string) ([]domain.Article, []domain.Series, error) {
	return nil, []domain.Series{{UserID: 1, Name: "Z"}, {UserID: 2, Name: "B"}, {UserID: 1, Name: "A"}}, s.err
}
func (s libraryStore) Save(context.Context, int64, int64, domain.Input) (int64, error) {
	return 1, s.err
}

type libraryPeople struct{ err error }

func (s libraryPeople) CanPublish(context.Context, int64) (bool, error) { return true, s.err }
func (s libraryPeople) Names(context.Context, []int64) (map[int64]string, error) {
	return map[int64]string{1: "Alice", 2: "Bob"}, s.err
}
func TestLibraryFailuresAndSeriesOrdering(t *testing.T) {
	for _, tc := range []struct {
		method, path, body  string
		identity            int
		storeErr, peopleErr error
		status              int
	}{
		{method: "GET", path: "/api/v1/library", status: 200},
		{method: "GET", path: "/api/v1/library", identity: 503, status: 503},
		{method: "GET", path: "/api/v1/library", storeErr: errors.New("offline"), status: 503},
		{method: "GET", path: "/api/v1/library", peopleErr: errors.New("offline"), status: 503},
		{method: "PUT", path: "/api/v1/library/bad", body: `{}`, status: 404},
		{method: "POST", path: "/api/v1/library", body: `{"title":"Title","body":"Body"}`, storeErr: domain.ErrRank, status: 422},
		{method: "POST", path: "/api/v1/library", body: `{"title":"Title","body":"Body"}`, storeErr: domain.ErrTotal, status: 422},
		{method: "POST", path: "/api/v1/library", body: `{"title":"Title","body":"Body"}`, storeErr: domain.ErrDaily, status: 422},
		{method: "POST", path: "/api/v1/library", body: `{"title":"Title","body":"Body"}`, storeErr: domain.ErrNotFound, status: 404},
		{method: "POST", path: "/api/v1/library", body: `{}`, status: 422},
	} {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			mux := http.NewServeMux()
			NewHandler(application.NewService(libraryStore{tc.storeErr}, libraryPeople{tc.peopleErr}), func(*http.Request, bool) (int64, int) { return 1, tc.identity }).Register(mux)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
			if w.Code != tc.status {
				t.Fatal(w.Code, w.Body)
			}
			if tc.status == 200 {
				body := w.Body.String()
				if strings.Index(body, `"name":"A"`) >= strings.Index(body, `"name":"Z"`) || strings.Index(body, `"name":"Z"`) >= strings.Index(body, `"name":"B"`) {
					t.Fatal(body)
				}
			}
		})
	}
}
