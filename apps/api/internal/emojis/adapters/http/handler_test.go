package http

import (
	"bytes"
	"chat/api/internal/emojis/application"
	"chat/api/internal/emojis/domain"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
)

type emojiStore struct {
	image domain.Image
	err   error
}

func (s emojiStore) List(context.Context) ([]domain.Emoji, error) {
	return []domain.Emoji{{ID: 1, Code: "CAT"}}, s.err
}
func (s emojiStore) Image(context.Context, int64) (domain.Image, error) { return s.image, s.err }
func TestPublicEmojiImages(t *testing.T) {
	for _, tc := range []struct {
		name, path string
		image      domain.Image
		err        error
		status     int
		location   string
	}{
		{name: "list", path: "/api/v1/chat/emojis", status: 200}, {name: "list error", path: "/api/v1/chat/emojis", err: errors.New("offline"), status: 503},
		{name: "bytes", path: "/emojis/1", image: domain.Image{Bytes: []byte("image"), ContentType: "image/png"}, status: 200},
		{name: "remote", path: "/emojis/1", image: domain.Image{Key: "emoji/a b.png"}, status: 302, location: "https://media.example/emoji/a%20b.png"},
		{name: "empty", path: "/emojis/1", status: 404}, {name: "bad ID", path: "/emojis/bad", status: 404}, {name: "zero ID", path: "/emojis/0", status: 404}, {name: "not found", path: "/emojis/1", err: errors.New("missing"), status: 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			mux := http.NewServeMux()
			NewHandler(application.NewService(emojiStore{tc.image, tc.err}), "https://media.example/").Register(mux)
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("GET", tc.path, nil))
			if w.Code != tc.status || w.Header().Get("Location") != tc.location {
				t.Fatal(w)
			}
			if tc.name == "bytes" && (w.Body.String() != "image" || w.Header().Get("X-Content-Type-Options") != "nosniff") {
				t.Fatal(w)
			}
			if tc.name == "list" && !strings.Contains(w.Body.String(), `"terms":[]`) {
				t.Fatal(w.Body)
			}
		})
	}
}

type uploadStore struct {
	saved []application.Upload
	err   error
}

func (s *uploadStore) Submit(_ context.Context, u application.Upload) error {
	s.saved = append(s.saved, u)
	return s.err
}

type inspector struct {
	width int
	err   error
}

func (i inspector) Inspect(context.Context, []byte, string) (int, int, bool, error) {
	return i.width, 32, false, i.err
}
func TestEmojiUploadValidatesBeforePersisting(t *testing.T) {
	for _, tc := range []struct {
		name, code, data        string
		identity, width, status int
		err                     error
	}{
		{name: "valid", code: " CAT ", data: "PNG", width: 32, status: 201}, {name: "unauthorized", identity: 401, status: 401},
		{name: "invalid code", code: "?", data: "PNG", width: 32, status: 422}, {name: "missing image", code: "cat", status: 422},
		{name: "oversized dimensions", code: "cat", data: "PNG", width: 101, status: 422}, {name: "zero dimensions", code: "cat", data: "PNG", status: 422},
		{name: "store error", code: "cat", data: "PNG", width: 32, err: errors.New("offline"), status: 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			if err := writer.WriteField("code", tc.code); err != nil {
				t.Fatal(err)
			}
			if tc.data != "" {
				headers := textproto.MIMEHeader{}
				headers.Set("Content-Disposition", `form-data; name="image"; filename="cat.png"`)
				headers.Set("Content-Type", "image/png")
				part, err := writer.CreatePart(headers)
				if err != nil {
					t.Fatal(err)
				}
				if _, err = part.Write([]byte(tc.data)); err != nil {
					t.Fatal(err)
				}
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}
			store := &uploadStore{err: tc.err}
			mux := http.NewServeMux()
			NewUploadHandler(application.NewUploader(store, inspector{width: tc.width}), func(*http.Request, bool) (int64, int) { return 1, tc.identity }).Register(mux)
			r := httptest.NewRequest("POST", "/api/v1/chat/emojis", &body)
			r.Header.Set("Content-Type", writer.FormDataContentType())
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatal(w)
			}
			if tc.status == 201 && (len(store.saved) != 1 || store.saved[0].Code != "-cat-" || store.saved[0].Width != 32) {
				t.Fatal(store.saved)
			}
		})
	}
}
