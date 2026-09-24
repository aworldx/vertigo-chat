package postgres

import (
	"chat/api/internal/profiles/domain"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type mediaTransport func(*http.Request) (*http.Response, error)

func (f mediaTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type mediaReadFailure struct{}

func (mediaReadFailure) Read([]byte) (int, error) { return 0, errors.New("read failed") }
func (mediaReadFailure) Close() error             { return nil }
func TestProfileStorageDoesNotPublishFailedOrUnverifiedMedia(t *testing.T) {
	for _, mode := range []string{"put network", "put denied", "get network", "get denied", "get read", "get mismatch", "invalid endpoint", "invalid public"} {
		t.Run(mode, func(t *testing.T) {
			config := S3Config{Endpoint: "https://storage.example", PublicBaseURL: "https://media.example", Region: "test", Bucket: "bucket", AccessKeyID: "test", SecretAccessKey: "test"}
			if mode == "invalid endpoint" {
				config.Endpoint = ":%"
			}
			if mode == "invalid public" {
				config.PublicBaseURL = ":%"
			}
			s := s3Media{config: config, client: &http.Client{Transport: mediaTransport(func(r *http.Request) (*http.Response, error) { return profileStorageFailure(mode, r) })}}
			photo, thumb, err := s.store(context.Background(), domain.PhotoInput{Bytes: []byte("photo"), ContentType: "image/png"}, []byte("thumbnail"))
			if err == nil || photo.key != nil || thumb.key != nil {
				t.Fatal("invalid objects published", photo, thumb, err)
			}
			if mode == "get network" || mode == "get denied" || mode == "get read" || mode == "invalid public" {
				if _, err := s.load(context.Background(), "key"); err == nil {
					t.Fatal("load failure ignored")
				}
			}
		})
	}
}
func profileStorageFailure(mode string, r *http.Request) (*http.Response, error) {
	if mode == "put network" && r.Method == "PUT" || mode == "get network" && r.Method == "GET" {
		return nil, errors.New("offline")
	}
	status := 200
	if mode == "put denied" && r.Method == "PUT" || mode == "get denied" && r.Method == "GET" {
		status = 403
	}
	body := io.NopCloser(strings.NewReader("wrong"))
	if mode == "get read" && r.Method == "GET" {
		body = mediaReadFailure{}
	}
	return &http.Response{StatusCode: status, Body: body}, nil
}
