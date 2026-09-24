package http

import (
	"chat/api/internal/emojis/application"
	"chat/api/internal/emojis/domain"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type managedStore struct {
	err   error
	image domain.Image
}

func (s managedStore) Managed(context.Context) ([]domain.ManagedEmoji, []domain.Tag, error) {
	return nil, nil, s.err
}
func (s managedStore) Moderate(context.Context, int64, domain.Moderation) error { return s.err }
func (s managedStore) Delete(context.Context, int64) error                      { return s.err }
func (s managedStore) SaveTag(context.Context, domain.Tag) (int64, error)       { return 1, s.err }
func (s managedStore) DeleteTag(context.Context, int64) error                   { return s.err }
func (s managedStore) ManagedImage(context.Context, int64) (domain.Image, error) {
	return s.image, s.err
}
func managerFixture(store managedStore, status int, namesErr error) http.Handler {
	management := application.NewManagement(store, func(context.Context, int64) (bool, error) { return true, nil }, application.Uploader{})
	mux := http.NewServeMux()
	NewManager(management, func(*http.Request, bool) (int64, int) { return 1, status }, "https://media.example", func(context.Context, []int64) (map[int64]string, error) { return nil, namesErr }).Register(mux)
	return mux
}
func TestEmojiManagementAuthorizationAndStoreFailures(t *testing.T) {
	for _, route := range []struct{ method, path, body string }{
		{"GET", "/api/v1/admin/emojis", ""}, {"PUT", "/api/v1/admin/emojis/1", `{"code":"cat","status":"approved"}`}, {"DELETE", "/api/v1/admin/emojis/1", ""}, {"GET", "/api/v1/admin/emojis/1/image", ""}, {"POST", "/api/v1/admin/emoji-tags", `{"name":"tag","triggers":[]}`}, {"DELETE", "/api/v1/admin/emoji-tags/1", ""},
	} {
		t.Run(route.method+route.path, func(t *testing.T) {
			for _, tc := range []struct {
				identity int
				err      error
				status   int
			}{{401, nil, 401}, {0, domain.ErrNotFound, 404}, {0, domain.ErrForbidden, 403}, {0, errors.New("offline"), 503}} {
				w := httptest.NewRecorder()
				managerFixture(managedStore{err: tc.err}, tc.identity, nil).ServeHTTP(w, httptest.NewRequest(route.method, route.path, strings.NewReader(route.body)))
				if w.Code != tc.status {
					t.Fatal(w.Code, w.Body, tc)
				}
			}
		})
	}
}
func TestEmojiManagementInvalidInputAndUnavailableImages(t *testing.T) {
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{"PUT", "/api/v1/admin/emojis/1", `{`, 422}, {"PUT", "/api/v1/admin/emojis/1", `{} {}`, 422},
		{"PUT", "/api/v1/admin/emoji-tags/bad", `{"name":"tag"}`, 404}, {"POST", "/api/v1/admin/emoji-tags", `{`, 422},
		{"POST", "/api/v1/admin/emojis", `{}`, 422}, {"GET", "/api/v1/admin/emojis/1/image", "", 503},
	} {
		w := httptest.NewRecorder()
		managerFixture(managedStore{}, 0, nil).ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
		if w.Code != tc.status {
			t.Fatal(tc, w.Code, w.Body)
		}
	}
	w := httptest.NewRecorder()
	managerFixture(managedStore{}, 0, errors.New("names offline")).ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/admin/emojis", nil))
	if w.Code != 503 {
		t.Fatal(w)
	}
	w = httptest.NewRecorder()
	managerFixture(managedStore{image: domain.Image{Key: "emoji/a b.png"}}, 0, nil).ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/admin/emojis/1/image", nil))
	if w.Code != 302 || w.Header().Get("Location") != "https://media.example/emoji/a%20b.png" {
		t.Fatal(w)
	}
}
func TestRemoteEmojiDeletionRequiresSuccessfulObjectRemoval(t *testing.T) {
	for _, mode := range []string{"missing remover", "failed remover", "success"} {
		management := application.NewManagement(managedStore{image: domain.Image{Key: "emoji/key"}}, func(context.Context, int64) (bool, error) { return true, nil }, application.Uploader{})
		calls := 0
		if mode != "missing remover" {
			management = management.WithObjectRemoval(func(_ context.Context, key string) error {
				calls++
				if key != "emoji/key" {
					t.Fatal(key)
				}
				if mode == "failed remover" {
					return errors.New("offline")
				}
				return nil
			})
		}
		err := management.Delete(context.Background(), 1, 1)
		if (err == nil) != (mode == "success") {
			t.Fatal(mode, err)
		}
		if mode != "missing remover" && calls != 1 {
			t.Fatal(calls)
		}
	}
}
