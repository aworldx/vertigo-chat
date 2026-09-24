package http

import (
	"bytes"
	"chat/api/internal/musicchart/application"
	"chat/api/internal/musicchart/domain"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"
)

type chartStore struct {
	audio          domain.Audio
	err            error
	title, comment string
	liked          bool
}

func (s *chartStore) List(context.Context, int64) ([]domain.Track, error) {
	return []domain.Track{{ID: 1, Title: "Song"}}, s.err
}
func (s *chartStore) Audio(context.Context, int64) (domain.Audio, error) { return s.audio, s.err }
func (s *chartStore) Add(_ context.Context, _ int64, title string, a domain.Audio) error {
	s.title = title
	s.audio = a
	return s.err
}
func (s *chartStore) Rename(_ context.Context, _, _ int64, title string) error {
	s.title = title
	return s.err
}
func (s *chartStore) Like(_ context.Context, _, _ int64, active bool) error {
	s.liked = active
	return s.err
}
func (s *chartStore) Comment(_ context.Context, _, _ int64, body string) error {
	s.comment = body
	return s.err
}
func chartHandler(store *chartStore, status int) http.Handler {
	mux := http.NewServeMux()
	NewHandler(application.NewService(store), func(*http.Request, bool) (int64, int) { return 7, status }, "https://media.example/").Register(mux)
	return mux
}
func TestChartRequests(t *testing.T) {
	for _, tc := range []struct {
		name, method, path, body string
		identity, status         int
		err                      error
	}{
		{name: "list", method: "GET", path: "/api/v1/music-chart", status: 200},
		{name: "anonymous list", method: "GET", path: "/api/v1/music-chart", identity: 401, status: 200},
		{name: "identity failure", method: "GET", path: "/api/v1/music-chart", identity: 503, status: 503},
		{name: "store failure", method: "GET", path: "/api/v1/music-chart", err: errors.New("offline"), status: 503},
		{name: "rename", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":" New "}`, status: 204},
		{name: "like", method: "PUT", path: "/api/v1/music-chart/1/like", body: `{"active":true}`, status: 204},
		{name: "comment", method: "POST", path: "/api/v1/music-chart/1/comments", body: `{"body":" Nice "}`, status: 204},
		{name: "invalid ID", method: "PATCH", path: "/api/v1/music-chart/bad", body: `{}`, status: 404},
		{name: "bad JSON", method: "PATCH", path: "/api/v1/music-chart/1", body: `{`, status: 422},
		{name: "unknown field", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"user_id":8}`, status: 422},
		{name: "empty title", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":" "}`, status: 422},
		{name: "long title", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":"` + strings.Repeat("я", 121) + `"}`, status: 422},
		{name: "zero ID", method: "PATCH", path: "/api/v1/music-chart/0", body: `{"title":"Name"}`, status: 403},
		{name: "zero like ID", method: "PUT", path: "/api/v1/music-chart/0/like", body: `{"active":true}`, status: 403},
		{name: "zero comment ID", method: "POST", path: "/api/v1/music-chart/0/comments", body: `{"body":"Nice"}`, status: 403},
		{name: "empty comment", method: "POST", path: "/api/v1/music-chart/1/comments", body: `{"body":" "}`, status: 422},
		{name: "forbidden", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":"New"}`, err: domain.ErrForbidden, status: 403},
		{name: "quota", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":"New"}`, err: domain.ErrLimit, status: 422},
		{name: "not found", method: "PATCH", path: "/api/v1/music-chart/1", body: `{"title":"New"}`, err: domain.ErrNotFound, status: 404},
		{name: "unauthorized mutation", method: "PATCH", path: "/api/v1/music-chart/1", identity: 401, status: 401},
		{name: "unauthorized upload", method: "POST", path: "/api/v1/music-chart", identity: 401, status: 401},
		{name: "nonmultipart upload", method: "POST", path: "/api/v1/music-chart", body: `{}`, status: 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := &chartStore{err: tc.err}
			response := httptest.NewRecorder()
			chartHandler(store, tc.identity).ServeHTTP(response, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
			if response.Code != tc.status {
				t.Fatalf("%d: %s", response.Code, response.Body)
			}
			switch tc.name {
			case "rename":
				if store.title != "New" {
					t.Fatal(store.title)
				}
			case "like":
				if !store.liked {
					t.Fatal("vote missing")
				}
			case "comment":
				if store.comment != "Nice" {
					t.Fatal(store.comment)
				}
			}
		})
	}
}
func TestChartAudio(t *testing.T) {
	for _, tc := range []struct {
		name, id string
		audio    domain.Audio
		err      error
		status   int
		location string
	}{
		{name: "inline", id: "1", audio: domain.Audio{Bytes: []byte("ID3-test"), ContentType: "audio/mpeg"}, status: 200},
		{name: "remote", id: "1", audio: domain.Audio{Key: "tracks/a b.mp3"}, status: 302, location: "https://media.example/tracks/a%20b.mp3"},
		{name: "missing bytes", id: "1", status: 502},
		{name: "invalid ID", id: "bad", status: 404},
		{name: "zero ID", id: "0", status: 404},
		{name: "missing", id: "1", err: domain.ErrNotFound, status: 404},
	} {
		t.Run(tc.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			chartHandler(&chartStore{audio: tc.audio, err: tc.err}, 0).ServeHTTP(response, httptest.NewRequest("GET", "/music-chart/tracks/"+tc.id, nil))
			if response.Code != tc.status || response.Header().Get("Location") != tc.location {
				t.Fatal(response)
			}
			if tc.name == "inline" && (response.Body.String() != "ID3-test" || response.Header().Get("X-Content-Type-Options") != "nosniff") {
				t.Fatal(response)
			}
		})
	}
}
func TestChartUpload(t *testing.T) {
	for _, tc := range []struct {
		name, kind, data string
		status           int
	}{
		{"MP3", "audio/mpeg", "ID3-valid", 201}, {"OGG", "audio/ogg", "OggS-valid", 201}, {"WAV alias", "audio/x-wav", "RIFF1234WAVE", 201},
		{"wrong signature", "audio/mpeg", "not audio", 422}, {"wrong type", "text/plain", "ID3-valid", 422}, {"empty", "audio/ogg", "", 422}, {"missing file", "", "", 422},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			if tc.kind != "" {
				header := textproto.MIMEHeader{}
				header.Set("Content-Disposition", `form-data; name="audio"; filename="Song.mp3"`)
				header.Set("Content-Type", tc.kind)
				part, err := writer.CreatePart(header)
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
			request := httptest.NewRequest("POST", "/api/v1/music-chart", &body)
			request.Header.Set("Content-Type", writer.FormDataContentType())
			store := &chartStore{}
			response := httptest.NewRecorder()
			chartHandler(store, 0).ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("%d %s", response.Code, response.Body)
			}
			if tc.status == 201 && (store.title != "Song" || string(store.audio.Bytes) != tc.data) {
				t.Fatal(store)
			}
		})
	}
}
