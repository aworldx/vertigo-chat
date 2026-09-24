package s3

import (
	"chat/api/internal/musicchart/domain"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type failingTransport func(*http.Request) (*http.Response, error)

func (f failingTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type failedReader struct{}

func (failedReader) Read([]byte) (int, error) { return 0, errors.New("read failed") }
func (failedReader) Close() error             { return nil }
func TestStorageFailuresNeverPublishAnObjectReference(t *testing.T) {
	if _, err := New(S3Config{}); err == nil {
		t.Fatal("empty configuration accepted")
	}
	for _, mode := range []string{"put network", "put status", "get network", "get status", "get corrupt", "get read", "redirect", "invalid endpoint", "invalid public"} {
		t.Run(mode, func(t *testing.T) {
			config := S3Config{Endpoint: "https://storage.example", Region: "test", Bucket: "bucket", AccessKeyID: "test", SecretAccessKey: "test", PublicBaseURL: "https://media.example"}
			if mode == "invalid endpoint" {
				config.Endpoint = ":%"
			}
			if mode == "invalid public" {
				config.PublicBaseURL = ":%"
			}
			s, err := New(config)
			if err != nil {
				t.Fatal(err)
			}
			s.client.Transport = failingTransport(func(r *http.Request) (*http.Response, error) { return storageFailureResponse(mode, r) })
			ctx := context.Background()
			result, err := s.Save(ctx, domain.Audio{Bytes: []byte("ID3-audio"), ContentType: "audio/mpeg"})
			if err == nil || result.Key != "" {
				t.Fatal("failed upload published", result, err)
			}
		})
	}
	s, err := New(S3Config{Endpoint: "https://storage.example", Region: "test", Bucket: "bucket", AccessKeyID: "test", SecretAccessKey: "test", VirtualHosted: true})
	if err != nil {
		t.Fatal(err)
	}
	address, err := s.objectURL("file", false)
	if err != nil || address != "https://bucket.storage.example/file" {
		t.Fatal(address, err)
	}
}

func storageFailureResponse(mode string, r *http.Request) (*http.Response, error) {
	if mode == "put network" && r.Method == "PUT" || mode == "get network" && r.Method == "GET" {
		return nil, errors.New("offline")
	}
	status := 200
	body := io.ReadCloser(io.NopCloser(strings.NewReader("wrong")))
	if mode == "put status" && r.Method == "PUT" || mode == "get status" && r.Method == "GET" {
		status = 503
	}
	if mode == "get read" && r.Method == "GET" {
		body = failedReader{}
	}
	headers := http.Header{}
	if mode == "redirect" {
		status = 302
		headers.Set("Location", "https://unexpected.example")
	}
	return &http.Response{StatusCode: status, Header: headers, Body: body, Request: r}, nil
}
